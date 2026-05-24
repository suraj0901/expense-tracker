import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { rupeesToPaise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { StoreExpenseSchema } from '../../agent/tool-schemas';

export const storeExpenseTool: ToolHandler = {
  name: 'store_expense',
  schema: StoreExpenseSchema,
  definition: {
    name: 'store_expense',
    description: 'Insert a new expense transaction. Call immediately when user mentions spending — do not ask first.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees (e.g. 120, 5000)' },
        category: { type: 'string', description: 'Category name' },
        merchant: { type: 'string', description: 'Merchant or store name, if mentioned' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string', description: 'Additional note' },
      },
      required: ['amount', 'category'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return deps.transactionRepo.insert({
      id: nanoid(),
      amount: rupeesToPaise(args.amount as number),
      type: 'expense',
      category: args.category as string,
      merchant: (args.merchant as string) ?? null,
      note: (args.note as string) ?? null,
      date: (args.date as string) ?? today,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    });
  },
};
