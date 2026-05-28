import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { SetBudgetSchema } from '../../agent/tool-schemas';
import { rupeesToPaise } from '../../domain/money';

export const setBudgetTool: ToolHandler = {
  name: 'set_budget',
  schema: SetBudgetSchema,
  definition: {
    name: 'set_budget',
    description: 'Set a monthly budget for a category. Amount in rupees.',
    parameters: {
      type: 'object',
      properties: {
        category_name: { type: 'string', description: 'Category to set budget for' },
        amount: { type: 'number', description: 'Monthly budget amount in rupees' },
      },
      required: ['category_name', 'amount'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const ok = await deps.categoryRepo.setBudget(args.category_name as string, rupeesToPaise(args.amount as number));
    return { success: ok, message: ok ? `Budget of ₹${args.amount} set for ${args.category_name}` : 'Category not found' };
  },
};
