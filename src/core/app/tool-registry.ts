/**
 * Tool registry — open/closed dispatch for AI tools.
 *
 * Each tool self-registers with name + schema + definition + handler.
 * The executor loops over registry entries. Adding a new tool means
 * creating a file and registering it — never editing the executor.
 */
import type { z } from 'zod';
import type { ToolCall, ToolResult } from '../domain/types';
import type { ToolDefinition } from '../agent/tools';
import type {
  TransactionRepository, CategoryRepository,
  GoalRepository, SummaryRepository,
} from './interfaces';
import { logger } from '../logger';

export interface ToolDependencies {
  transactionRepo: TransactionRepository;
  categoryRepo: CategoryRepository;
  goalRepo: GoalRepository;
  summaryRepo: SummaryRepository;
}

export interface ToolHandler {
  name: string;
  schema: z.ZodSchema;
  definition: ToolDefinition;
  execute(args: Record<string, unknown>, deps: ToolDependencies): Promise<unknown>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    if (this.tools.has(handler.name)) {
      logger.warn('toolRegistry:duplicate', { toolName: handler.name });
    }
    this.tools.set(handler.name, handler);
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async execute(call: ToolCall, deps: ToolDependencies): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { toolCallId: call.id, result: null, error: `Unknown tool: ${call.name}` };
    }

    const parseResult = tool.schema.safeParse(call.args);
    if (!parseResult.success) {
      return {
        toolCallId: call.id,
        result: null,
        error: `Invalid arguments: ${parseResult.error.message}`,
      };
    }

    try {
      const result = await tool.execute(call.args, deps);
      return { toolCallId: call.id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unknown error executing ${call.name}`;
      return { toolCallId: call.id, result: null, error: message };
    }
  }
}
