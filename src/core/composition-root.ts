/**
 * Composition root — the single file that wires providers to consumers.
 *
 * Every interface-to-implementation binding happens here. Nothing else
 * in the codebase calls `new` on a concrete implementation — only the
 * composition root wires concrete classes.
 */
import { EventBus } from './app/event-bus';
import { ToolRegistry } from './app/tool-registry';
import { ProviderRegistry } from './app/provider-registry';
import type { ToolDependencies } from './app/tool-registry';

import { createTransactionRepository } from './infrastructure/sqlite-transaction-repository';
import { createMessageRepository } from './infrastructure/sqlite-message-repository';
import { createCategoryRepository } from './infrastructure/sqlite-category-repository';
import { createMerchantHintRepository } from './infrastructure/sqlite-merchant-hint-repository';
import { createGoalRepository } from './infrastructure/sqlite-goal-repository';
import { createSummaryRepository } from './infrastructure/sqlite-summary-repository';
import { createInsightRepository } from './infrastructure/sqlite-insight-repository';

import { storeExpenseTool } from './app/tools/store-expense.tool';
import { storeIncomeTool } from './app/tools/store-income.tool';
import { getExpensesTool } from './app/tools/get-expenses.tool';
import { getMonthlySummaryTool } from './app/tools/get-monthly-summary.tool';
import { getCategoryBreakdownTool } from './app/tools/get-category-breakdown.tool';
import { getRecentTransactionsTool } from './app/tools/get-recent-transactions.tool';
import { updateExpenseTool } from './app/tools/update-expense.tool';
import { deleteExpenseTool } from './app/tools/delete-expense.tool';
import { undoDeleteTool } from './app/tools/undo-delete.tool';
import { getBudgetStatusTool } from './app/tools/get-budget-status.tool';
import { setGoalTool } from './app/tools/set-goal.tool';
import { getGoalsTool } from './app/tools/get-goals.tool';
import { deleteGoalTool } from './app/tools/delete-goal.tool';
import { listCategoriesTool } from './app/tools/list-categories.tool';
import { createCategoryTool } from './app/tools/create-category.tool';

import { AnthropicProvider } from './providers/anthropic';
import { GeminiProvider } from './providers/gemini';
import { DeepSeekProvider } from './providers/deepseek';
import { LocalAIProvider } from './providers/local';

// ─── Event Types ─────────────────────────────────────────────────────────

type AppEvents = {
  'transaction:created': [{ merchant: string | null; category: string }];
  'transaction:updated': [{ merchant?: string; category?: string }];
};

// ─── Event Bus ───────────────────────────────────────────────────────────

export const eventBus = new EventBus<AppEvents>();

// ─── Repositories ────────────────────────────────────────────────────────

export const transactionRepo = createTransactionRepository();
export const messageRepo = createMessageRepository();
export const categoryRepo = createCategoryRepository();
export const merchantHintRepo = createMerchantHintRepository();
export const goalRepo = createGoalRepository();
export const summaryRepo = createSummaryRepository();
export const insightRepo = createInsightRepository();

// ─── Event Bus Wiring ────────────────────────────────────────────────────

eventBus.on('transaction:created', (args) => {
  if (args.merchant) merchantHintRepo.upsert(args.merchant, args.category).catch(() => {});
});

eventBus.on('transaction:updated', (args) => {
  if (args.merchant && args.category) merchantHintRepo.upsert(args.merchant, args.category).catch(() => {});
});

// ─── Tool Registry ───────────────────────────────────────────────────────

export const toolRegistry = new ToolRegistry();
toolRegistry.register(storeExpenseTool);
toolRegistry.register(storeIncomeTool);
toolRegistry.register(getExpensesTool);
toolRegistry.register(getMonthlySummaryTool);
toolRegistry.register(getCategoryBreakdownTool);
toolRegistry.register(getRecentTransactionsTool);
toolRegistry.register(updateExpenseTool);
toolRegistry.register(deleteExpenseTool);
toolRegistry.register(undoDeleteTool);
toolRegistry.register(getBudgetStatusTool);
toolRegistry.register(setGoalTool);
toolRegistry.register(getGoalsTool);
toolRegistry.register(deleteGoalTool);
toolRegistry.register(listCategoriesTool);
toolRegistry.register(createCategoryTool);

// ─── Tool Dependencies ───────────────────────────────────────────────────

export const toolDeps: ToolDependencies = {
  transactionRepo,
  categoryRepo,
  goalRepo,
  summaryRepo,
};

// ─── Provider Registry ───────────────────────────────────────────────────

export const providerRegistry = new ProviderRegistry();
providerRegistry.register('anthropic', (key) => new AnthropicProvider(key));
providerRegistry.register('gemini', (key) => new GeminiProvider(key));
providerRegistry.register('deepseek', (key) => new DeepSeekProvider(key));
providerRegistry.register('webllm', () => new LocalAIProvider());
