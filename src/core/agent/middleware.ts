/**
 * Middleware pipeline — composable processing stages for the agent loop.
 *
 * Each middleware wraps a single step of processMessage(). The pipeline
 * is an onion: pre-processing → AI call → post-processing.
 */

import { nanoid } from 'nanoid';
import type { AIProvider, ProviderMessage, ProviderResponse } from '../providers/types';
import type { Message, ToolCallRecord } from '../domain/types';
import { TOOL_DEFINITIONS } from './tools';
import { executeTool } from './tool-executor';
import { buildSystemPrompt } from './system-prompt';
import { messageRepo, merchantHintRepo, eventRepo } from '../composition-root';

/** Detect whether the user message mentions spending or earning money. */
export function hasSpendingIntent(message: string): boolean {
  const patterns = [
    /₹\d+/,
    /\d+(\.\d+)?\s*(rs|rupees|rupaye)\b/i,
    /\d+(\.\d+)?\s*(k|lakh|lac|L)\b/i,
    /\b(spent|paid|gave|bought|purchased|cost|bill|kharcha|expense)\b/i,
    /\b(received|got paid|salary|income|earned|kamaya|credit|deposit)\b/i,
    /\b(auto|chai|lunch|dinner|breakfast|coffee|tea|cab|uber|ola|swiggy|zomato)\b/i,
    /\[Auto-parsed:/,
  ];
  return patterns.some((p) => p.test(message));
}

/** Check if any tool call in the list is a logging operation. */
export function hasLoggingToolCall(toolCalls: ToolCallRecord[]): boolean {
  return toolCalls.some((tc) =>
    tc.name === 'store_expense' || tc.name === 'store_income'
  );
}

export interface AgentContext {
  userMessage: string;
  history: Message[];
  provider: AIProvider;
  traceId: string;
  messages: ProviderMessage[];
  response: ProviderResponse;
  allToolCalls: ToolCallRecord[];
  spendingDetected: boolean;
}

export interface Middleware {
  name: string;
  process(ctx: AgentContext, next: () => Promise<AgentContext>): Promise<AgentContext>;
}

export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  use(mw: Middleware): void {
    this.middlewares.push(mw);
  }

  compose(middlewares: Middleware[]): void {
    this.middlewares = middlewares;
  }

  async run(ctx: AgentContext): Promise<AgentContext> {
    let index = 0;
    const mw = this.middlewares;

    const next = async (): Promise<AgentContext> => {
      if (index >= mw.length) return ctx;
      const current = mw[index++];
      return current.process(ctx, next);
    };

    return next();
  }
}

// ─── Middleware Implementations ──────────────────────────────────────────

/** Load merchant hints and build the system prompt. */
export const loadMerchantHintsMiddleware: Middleware = {
  name: 'loadMerchantHints',
  async process(ctx, next) {
    const hints = await merchantHintRepo.getTop(30);
    const hintObjects = hints.map((h) => ({
      canonicalName: h.canonicalName,
      category: h.category,
      useCount: h.useCount,
      lastUsedAt: h.lastUsedAt,
      confirmStrategy: h.confirmStrategy,
    }));
    const systemPrompt = buildSystemPrompt(hintObjects);
    ctx.messages = [{ role: 'system', content: systemPrompt }];
    return next();
  },
};

/** Truncate history and append user message. */
export const buildMessagesMiddleware: Middleware = {
  name: 'buildMessages',
  async process(ctx, next) {
    const historyMessages = ctx.history.slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    ctx.messages = [...ctx.messages, ...historyMessages, { role: 'user', content: ctx.userMessage }];
    return next();
  },
};

/** Persist the user message to DB. */
export const persistUserMessageMiddleware: Middleware = {
  name: 'persistUserMessage',
  async process(ctx, next) {
    await messageRepo.save({
      id: nanoid(),
      role: 'user',
      content: ctx.userMessage,
      createdAt: Date.now(),
    });
    return next();
  },
};

/** Detect spending intent and augment the user message. */
export const spendingGuardAugmentMiddleware: Middleware = {
  name: 'spendingGuardAugment',
  async process(ctx, next) {
    ctx.spendingDetected = hasSpendingIntent(ctx.userMessage);
    if (ctx.spendingDetected) {
      const last = ctx.messages[ctx.messages.length - 1];
      ctx.messages[ctx.messages.length - 1] = {
        role: 'user',
        content: `[REMINDER: You MUST call store_expense() or store_income() for any amounts mentioned. Never end your turn without calling these tools.]\n\n${last.content}`,
      };
    }
    return next();
  },
};

/** Call the AI provider and execute the tool loop. */
export const callAIProviderMiddleware: Middleware = {
  name: 'callAIProvider',
  async process(ctx, next) {
    let response = await ctx.provider.chat(ctx.messages, TOOL_DEFINITIONS);
    response = await executeToolLoop_(response, ctx.messages, ctx.provider, ctx.allToolCalls, ctx.traceId);
    ctx.response = response;
    return next();
  },
};

/** Enforce the spending guard — if spending was mentioned but no logging tool was called. */
export const enforceSpendingGuardMiddleware: Middleware = {
  name: 'enforceSpendingGuard',
  async process(ctx, next) {
    if (ctx.spendingDetected && !hasLoggingToolCall(ctx.allToolCalls)) {
      ctx.messages.push({
        role: 'user',
        content: 'CRITICAL: You must call store_expense() or store_income() now. The user mentioned spending or earning money — log it immediately using the appropriate tool.',
      });
      const guardResponse = await ctx.provider.chat(ctx.messages, TOOL_DEFINITIONS);
      await executeToolLoop_(guardResponse, ctx.messages, ctx.provider, ctx.allToolCalls, ctx.traceId);
    }
    return next();
  },
};

/** Persist the assistant message and tool calls. */
export const persistResponseMiddleware: Middleware = {
  name: 'persistResponse',
  async process(ctx, next) {
    await messageRepo.save({
      id: nanoid(),
      role: 'assistant',
      content: ctx.response.content,
      toolCalls: ctx.allToolCalls.length > 0 ? ctx.allToolCalls : null,
      createdAt: Date.now(),
    });
    return next();
  },
};

/** Create ai_query_response event for non-logging queries. */
export const createEventsMiddleware: Middleware = {
  name: 'createEvents',
  async process(ctx, next) {
    if (!hasLoggingToolCall(ctx.allToolCalls) && ctx.response.content.length > 20) {
      eventRepo.insert({
        id: nanoid(),
        type: 'ai_query_response',
        title: 'AI Response',
        body: ctx.response.content.length > 200
          ? ctx.response.content.slice(0, 200) + '…'
          : ctx.response.content,
        data: {
          fullResponse: ctx.response.content,
          queryText: ctx.userMessage,
          toolsUsed: ctx.allToolCalls.map(tc => tc.name),
        },
        createdAt: Date.now(),
      }).catch(() => {});
    }
    return next();
  },
};

/** Check merchant confidence and create merchant_mapping_ask events. */
export const checkMerchantConfidenceMiddleware: Middleware = {
  name: 'checkMerchantConfidence',
  async process(ctx, next) {
    const hints = await merchantHintRepo.getTop(50);
    const hintNames = new Set(hints.map(h => h.canonicalName));
    const hintMap = new Map(hints.map(h => [h.canonicalName, h]));

    for (const tc of ctx.allToolCalls) {
      if (tc.name !== 'store_expense') continue;
      const merchant = (tc.args?.merchant as string)?.toLowerCase()?.trim();
      if (!merchant) continue;

      const existingHint = hintMap.get(merchant);
      if (existingHint && existingHint.confirmStrategy === 'dismissed') continue;

      if (existingHint && existingHint.confirmStrategy === 'ask_always') {
        await eventRepo.insert({
          id: nanoid(),
          type: 'merchant_mapping_ask',
          title: `Confirm: ${tc.args?.merchant as string}`,
          body: `Is "${tc.args?.merchant as string}" always "${tc.args?.category as string}"?`,
          data: {
            merchant: tc.args?.merchant as string,
            suggestedCategory: tc.args?.category as string,
            transactionId: (tc.result as Record<string, unknown>)?.id,
            historicalContext: `Previously categorized as "${existingHint.category}" (${existingHint.useCount} times)`,
          },
          createdAt: Date.now(),
        }).catch(() => {});
        continue;
      }

      if (!hintNames.has(merchant)) {
        const similar = findSimilar(hints, merchant);
        await eventRepo.insert({
          id: nanoid(),
          type: 'merchant_mapping_ask',
          title: `New merchant: ${tc.args?.merchant as string}`,
          body: `Should "${tc.args?.merchant as string}" always be "${tc.args?.category as string}"?`,
          data: {
            merchant: tc.args?.merchant as string,
            suggestedCategory: tc.args?.category as string,
            transactionId: (tc.result as Record<string, unknown>)?.id,
            historicalContext: similar
              ? `You usually categorize "${similar.canonicalName}" as "${similar.category}"`
              : null,
          },
          createdAt: Date.now(),
        }).catch(() => {});
      }
    }
    return next();
  },
};

/** Append proactive pending event reminders. */
export const proactiveSuggestionsMiddleware: Middleware = {
  name: 'proactiveSuggestions',
  async process(ctx, next) {
    const parts: string[] = [];

    const pendingEvents = await eventRepo.getRecent(5);
    if (pendingEvents.some((e) => e.type === 'merchant_mapping_ask' && e.status === 'pending')) {
      parts.push('You have pending merchant confirmations — ask me to review them');
    }
    if (pendingEvents.some((e) => e.type === 'recurring_suggestion' && e.status === 'pending')) {
      parts.push('I found recurring spending patterns — ask me to check them');
    }

    if (parts.length > 0) {
      ctx.response.content += '\n\n💡 ' + parts.join('\n💡 ');
    }
    return next();
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

async function executeToolLoop_(
  response: ProviderResponse,
  messages: ProviderMessage[],
  provider: AIProvider,
  allToolCalls: ToolCallRecord[],
  traceId: string
): Promise<ProviderResponse> {
  const MAX_ITERATIONS = 8;
  let loopIteration = 0;
  while (response.hasToolCalls) {
    loopIteration++;
    if (loopIteration > MAX_ITERATIONS) {
      response = { content: 'I ran into an issue processing your request.', hasToolCalls: false, toolCalls: [], raw: null };
      break;
    }

    const toolResults = await Promise.all(
      response.toolCalls.map((tc) => executeTool(tc, traceId))
    );
    for (let i = 0; i < response.toolCalls.length; i++) {
      allToolCalls.push({
        id: response.toolCalls[i].id,
        name: response.toolCalls[i].name,
        args: response.toolCalls[i].args,
        result: toolResults[i].result,
      });
    }
    messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
    });
    for (let i = 0; i < response.toolCalls.length; i++) {
      messages.push({
        role: 'tool',
        toolCallId: toolResults[i].toolCallId,
        content: JSON.stringify(toolResults[i].error ? { error: toolResults[i].error } : toolResults[i].result),
      });
    }
    response = await provider.chat(messages, TOOL_DEFINITIONS);
  }
  return response;
}

function findSimilar(
  hints: Array<{ canonicalName: string; category: string; useCount: number; lastUsedAt: number; confirmStrategy: string }>,
  merchant: string
): { canonicalName: string; category: string } | null {
  for (const h of hints) {
    if (h.canonicalName.includes(merchant) || merchant.includes(h.canonicalName)) {
      return { canonicalName: h.canonicalName, category: h.category };
    }
  }
  return null;
}
