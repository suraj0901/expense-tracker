import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetBudgetsSchema } from '../../agent/tool-schemas';
import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';

export const getBudgetsTool: ToolHandler = {
  name: 'get_budgets',
  schema: GetBudgetsSchema,
  definition: {
    name: 'get_budgets',
    description: 'List all categories that have budgets set, with their monthly amounts.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    const cats = await deps.categoryRepo.getBudgeted();
    if (cats.length === 0) return { budgets: [], message: 'No budgets set. Use set_budget to create one.' };
    return {
      budgets: cats.map((c) => ({
        category: c.name,
        icon: c.icon,
        monthly_budget: paiseToRupees(c.budgetAmount as Paise),
      })),
    };
  },
};
