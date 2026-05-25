import { rupeesToPaise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { UpdateExpenseSchema } from '../../agent/tool-schemas';

export const updateExpenseTool: ToolHandler = {
  name: 'update_expense',
  schema: UpdateExpenseSchema,
  definition: {
    name: 'update_expense',
    description: 'Correct an existing transaction. Partial update.',
    parameters: {
      type: 'object',
      properties: {
        transaction_id: { type: 'string', description: 'Transaction ID' },
        amount: { type: 'number', description: 'New amount in rupees' },
        category: { type: 'string', description: 'New category' },
        merchant: { type: 'string', description: 'New merchant' },
        note: { type: 'string', description: 'New note' },
      },
      required: ['transaction_id'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    return deps.transactionRepo.update(args.transaction_id as string, {
      amount: args.amount ? rupeesToPaise(args.amount as number) : undefined,
      category: args.category as string | undefined,
      merchant: args.merchant as string | undefined,
      note: args.note as string | undefined,
      description: (args.description as string | null) ?? undefined,
      tags: args.tags as string[] | undefined,
      updatedAt: Date.now(),
    });
  },
};
