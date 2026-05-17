/**
 * Agent loop — the entire application intelligence.
 *
 * processMessage replaces the extraction pipeline, query classifier,
 * pattern engine, suggestion engine, query template library, and
 * report generator from v1.0. About 50 lines of core logic.
 */

import { nanoid } from 'nanoid';
import type {
  AIProvider,
  ProviderMessage,
  ProviderToolResultMessage,
} from '../providers/types';
import type { AgentResponse, Message, ToolCallRecord } from '../domain/types';
import { TOOL_DEFINITIONS } from './tools';
import { executeTool } from './tool-executor';
import { buildSystemPrompt } from './system-prompt';
import * as db from '../db/client';

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
  // Inject merchant hints for cross-session memory
  const hints = await db.getMerchantHints(30);
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
  await db.saveMessage({
    id: nanoid(),
    role: 'user',
    content: userMessage,
    createdAt: Date.now(),
  });

  // Call AI provider
  let response = await provider.chat(messages, TOOL_DEFINITIONS);

  // Collect all tool calls for the response
  const allToolCalls: ToolCallRecord[] = [];

  // Agentic loop — AI may call multiple tools in sequence
  // e.g. "auto 25, chai 15, lunch 120" → 3 store_expense calls
  while (response.hasToolCalls) {
    const toolResults = await Promise.all(
      response.toolCalls.map(executeTool)
    );

    // Track tool calls
    for (let i = 0; i < response.toolCalls.length; i++) {
      allToolCalls.push({
        name: response.toolCalls[i].name,
        args: response.toolCalls[i].args,
        result: toolResults[i].result,
      });
    }

    // Send tool results back to AI
    const toolResultMessages: ProviderToolResultMessage[] = toolResults.map((tr, i) => ({
      role: 'tool' as const,
      toolCallId: tr.toolCallId,
      name: response.toolCalls[i].name,
      content: JSON.stringify(tr.error ? { error: tr.error } : tr.result),
    }));

    response = await provider.chatWithToolResults(
      messages,
      toolResultMessages,
      TOOL_DEFINITIONS,
      response.raw
    );
  }

  // Persist assistant message + any tool calls to messages table
  await db.saveMessage({
    id: nanoid(),
    role: 'assistant',
    content: response.content,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
    createdAt: Date.now(),
  });

  return {
    text: response.content,
    toolsUsed: allToolCalls,
  };
}
