import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteExpenseSchema } from '../../agent/tool-schemas';

export const deleteExpenseTool: ToolHandler = {
  name: 'delete_expense',
  schema: DeleteExpenseSchema,
  definition: {
    name: 'delete_expense',
    description: 'Soft-delete a transaction.',
    parameters: {
      type: 'object',
      properties: { transaction_id: { type: 'string', description: 'Transaction ID' } },
      required: ['transaction_id'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    return deps.transactionRepo.softDelete(args.transaction_id as string);
  },
};
