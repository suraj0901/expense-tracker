/**
 * Agent loop — the entire application intelligence.
 *
 * processMessage replaces the extraction pipeline, query classifier,
 * pattern engine, suggestion engine, query template library, and
 * report generator from v1.0. About 50 lines of core logic.
 */

import { nanoid } from 'nanoid';
import type { AIProvider, ProviderMessage, ProviderResponse } from '../providers/types';
import type { AgentResponse, Message, ToolCallRecord } from '../domain/types';
import { TOOL_DEFINITIONS } from './tools';
import { executeTool } from './tool-executor';
import { buildSystemPrompt } from './system-prompt';
import { messageRepo, merchantHintRepo } from '../composition-root';
import { logger } from '../logger';

/**
 * Process a user message through the AI agent loop.
 *
 * 1. Inject merchant hints for cross-session memory
 * 2. Build system prompt + last 20 messages
 * 3. Call AI provider
 * 4. Execute any tool calls (agentic loop)
 * 5. Persist messages to DB
 * 6. Return response
 */
export async function processMessage(
  userMessage: string,
  history: Message[],
  provider: AIProvider
): Promise<AgentResponse> {
  const traceId = logger.startTrace('agent:processMessage', {
    provider: provider.id,
    historyLength: history.length,
    userMessageLength: userMessage.length,
  });

  try {
    // Inject merchant hints for cross-session memory
    const hints = await merchantHintRepo.getTop(30);
    const hintObjects = hints.map((h) => ({
      canonicalName: h.canonicalName,
      category: h.category,
      useCount: h.useCount,
      lastUsedAt: h.lastUsedAt,
    }));
    const context = buildSystemPrompt(hintObjects);

    // Build message array: system + last 20 messages + new user message
    const messages: ProviderMessage[] = [
      { role: 'system', content: context },
      ...history.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    // Save user message
    await messageRepo.save({
      id: nanoid(),
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
    });

    // Detect spending/income intent for guard enforcement
    const spendingDetected = hasSpendingIntent(userMessage);

    // Augment user message with logging directive when spending detected
    if (spendingDetected) {
      logger.debug('agent:spendingIntentDetected', { traceId, userMessage: userMessage.slice(0, 80) });
      messages[messages.length - 1] = {
        role: 'user',
        content: `[REMINDER: You MUST call store_expense() or store_income() for any amounts mentioned. Never end your turn without calling these tools.]\n\n${userMessage}`,
      };
    }

    // Call AI provider
    let response: ProviderResponse = await provider.chat(messages, TOOL_DEFINITIONS);

    // Collect all tool calls for the response
    const allToolCalls: ToolCallRecord[] = [];

    // Agentic loop — AI may call multiple tools in sequence
    response = await executeToolLoop(response, messages, provider, allToolCalls, traceId);

    // Guard: if spending was mentioned but no logging tool was called, nudge once
    if (spendingDetected && !hasLoggingToolCall(allToolCalls)) {
      logger.warn('agent:guardTriggered', {
        traceId,
        toolCallsSoFar: allToolCalls.map((tc) => tc.name),
      });
      messages.push({
        role: 'user',
        content: 'CRITICAL: You must call store_expense() or store_income() now. The user mentioned spending or earning money — log it immediately using the appropriate tool.',
      });
      const guardResponse = await provider.chat(messages, TOOL_DEFINITIONS);
      await executeToolLoop(guardResponse, messages, provider, allToolCalls, traceId);
    }

    // Persist assistant message + any tool calls to messages table
    await messageRepo.save({
      id: nanoid(),
      role: 'assistant',
      content: response.content,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
      createdAt: Date.now(),
    });

    logger.endTrace(traceId, 'agent:processMessage', 'success', {
      toolCallsCount: allToolCalls.length,
      toolCalls: allToolCalls.map((tc) => tc.name),
      responseLength: response.content.length,
    });

    return {
      text: response.content,
      toolsUsed: allToolCalls,
    };
  } catch (error) {
    logger.endTrace(traceId, 'agent:processMessage', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Execute the tool-call loop until the AI responds with text only. */
async function executeToolLoop(
  response: ProviderResponse,
  messages: ProviderMessage[],
  provider: AIProvider,
  allToolCalls: ToolCallRecord[],
  traceId: string
): Promise<ProviderResponse> {
  let loopIteration = 0;
  while (response.hasToolCalls) {
    loopIteration++;
    logger.info('agent:toolLoopIteration', {
      traceId,
      iteration: loopIteration,
      toolNames: response.toolCalls.map((tc) => tc.name),
      hasText: response.content.length > 0,
    });

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
      toolCalls: response.toolCalls.map((tc) => ({
        id: tc.id, name: tc.name, args: tc.args,
      })),
    });
    for (let i = 0; i < response.toolCalls.length; i++) {
      const tr = toolResults[i];
      messages.push({
        role: 'tool',
        toolCallId: tr.toolCallId,
        content: JSON.stringify(tr.error ? { error: tr.error } : tr.result),
      });
    }
    response = await provider.chat(messages, TOOL_DEFINITIONS);
  }
  return response;
}

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
