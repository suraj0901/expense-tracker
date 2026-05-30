/**
 * Agent loop — thin wrapper over the middleware pipeline.
 *
 * processMessage() composes a pipeline of named middleware stages.
 * The actual processing logic lives in middleware.ts.
 */

import type { AIProvider } from '../providers/types';
import type { AgentResponse, Message } from '../domain/types';
import {
  MiddlewarePipeline,
  type AgentContext,
  loadMerchantHintsMiddleware,
  buildMessagesMiddleware,
  persistUserMessageMiddleware,
  spendingGuardAugmentMiddleware,
  callAIProviderMiddleware,
  enforceSpendingGuardMiddleware,
  persistResponseMiddleware,
  createEventsMiddleware,
  checkMerchantConfidenceMiddleware,
  proactiveSuggestionsMiddleware,
} from './middleware';
import { logger } from '../logger';

export { hasSpendingIntent, hasLoggingToolCall } from './middleware';

const pipeline = new MiddlewarePipeline();
pipeline.compose([
  loadMerchantHintsMiddleware,
  buildMessagesMiddleware,
  persistUserMessageMiddleware,
  spendingGuardAugmentMiddleware,
  callAIProviderMiddleware,
  enforceSpendingGuardMiddleware,
  persistResponseMiddleware,
  createEventsMiddleware,
  checkMerchantConfidenceMiddleware,
  proactiveSuggestionsMiddleware,
]);

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
    const ctx: AgentContext = {
      userMessage,
      history,
      provider,
      traceId,
      messages: [],
      response: { content: '', hasToolCalls: false, toolCalls: [], raw: null },
      allToolCalls: [],
      spendingDetected: false,
    };

    const result = await pipeline.run(ctx);

    logger.endTrace(traceId, 'agent:processMessage', 'success', {
      toolCallsCount: result.allToolCalls.length,
      toolCalls: result.allToolCalls.map((tc) => tc.name),
      responseLength: result.response.content.length,
    });

    return {
      text: result.response.content,
      toolsUsed: result.allToolCalls,
    };
  } catch (error) {
    logger.endTrace(traceId, 'agent:processMessage', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
