/**
 * Tool executor — delegates to the tool registry.
 *
 * Validates arguments with Zod, delegates to registry for execution.
 * Money conversion (rupeesToPaise/paiseToRupees) happens inside each
 * registered tool handler — at the boundary, not here.
 */
import type { ToolCall, ToolResult } from '../domain/types';
import { toolRegistry, toolDeps } from '../composition-root';
import { logger } from '../logger';

export async function executeTool(call: ToolCall, traceId?: string): Promise<ToolResult> {
  const start = performance.now();
  logger.info('tool:execute', {
    traceId,
    toolName: call.name,
    toolCallId: call.id,
  });
  logger.debug('tool:args', { traceId, toolName: call.name, args: call.args });

  const result = await toolRegistry.execute(call, toolDeps);

  const durationMs = Math.round(performance.now() - start);
  if (result.error) {
    logger.error('tool:failed', new Error(result.error), {
      traceId, toolName: call.name, durationMs,
    });
  } else {
    logger.info('tool:success', { traceId, toolName: call.name, durationMs });
  }

  return result;
}
