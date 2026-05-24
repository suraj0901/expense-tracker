import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetBudgetStatusSchema } from '../../agent/tool-schemas';

export const getBudgetStatusTool: ToolHandler = {
  name: 'get_budget_status',
  schema: GetBudgetStatusSchema,
  definition: {
    name: 'get_budget_status',
    description: 'Get current month spend vs budget per category.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    return deps.summaryRepo.getBudgetStatus();
  },
};
