import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteBudgetSchema } from '../../agent/tool-schemas';

export const deleteBudgetTool: ToolHandler = {
  name: 'delete_budget',
  schema: DeleteBudgetSchema,
  definition: {
    name: 'delete_budget',
    description: 'Remove the budget from a category.',
    parameters: {
      type: 'object',
      properties: {
        category_name: { type: 'string', description: 'Category to remove budget from' },
      },
      required: ['category_name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const ok = await deps.categoryRepo.clearBudget(args.category_name as string);
    return { success: ok, message: ok ? `Budget removed from ${args.category_name}` : 'Category not found' };
  },
};
