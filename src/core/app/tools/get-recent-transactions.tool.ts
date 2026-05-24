import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetRecentTransactionsSchema } from '../../agent/tool-schemas';

export const getRecentTransactionsTool: ToolHandler = {
  name: 'get_recent_transactions',
  schema: GetRecentTransactionsSchema,
  definition: {
    name: 'get_recent_transactions',
    description: 'Get the most recent N transactions.',
    parameters: {
      type: 'object',
      properties: { count: { type: 'number', description: 'Number of recent transactions. Default 10.' } },
      required: [],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const recent = await deps.transactionRepo.getRecent((args.count as number) ?? 10);
    return recent.map((t) => ({
      id: t.id, amount: paiseToRupees(t.amount as Paise),
      type: t.type, category: t.category,
      merchant: t.merchant, note: t.note, date: t.date,
    }));
  },
};
