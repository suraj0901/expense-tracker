import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetExpensesSchema } from '../../agent/tool-schemas';

export const getExpensesTool: ToolHandler = {
  name: 'get_expenses',
  schema: GetExpensesSchema,
  definition: {
    name: 'get_expenses',
    description: 'Query transactions with optional filters.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category' },
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
        merchant: { type: 'string', description: 'Filter by merchant' },
        limit: { type: 'number', description: 'Max results. Default 50.' },
      },
      required: [],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const results = await deps.transactionRepo.query({
      category: args.category as string | undefined,
      start_date: args.start_date as string | undefined,
      end_date: args.end_date as string | undefined,
      merchant: args.merchant as string | undefined,
      limit: args.limit as number | undefined,
    });
    return results.map((t) => ({
      id: t.id, amount: paiseToRupees(t.amount as Paise),
      type: t.type, category: t.category,
      merchant: t.merchant, note: t.note, date: t.date,
    }));
  },
};
