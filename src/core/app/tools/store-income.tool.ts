import { nanoid } from 'nanoid';
import { format } from 'date-fns';
import { rupeesToPaise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { StoreIncomeSchema } from '../../agent/tool-schemas';

export const storeIncomeTool: ToolHandler = {
  name: 'store_income',
  schema: StoreIncomeSchema,
  definition: {
    name: 'store_income',
    description: 'Insert a new income transaction.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in rupees' },
        source: { type: 'string', description: 'Source of income (e.g. salary, freelance)' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string', description: 'Additional note' },
      },
      required: ['amount', 'source'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return deps.transactionRepo.insert({
      id: nanoid(),
      amount: rupeesToPaise(args.amount as number),
      type: 'income',
      category: (args.source as string) ?? 'Income',
      merchant: null,
      note: (args.note as string) ?? null,
      description: (args.description as string) ?? null,
      tags: args.tags as string[] | undefined,
      date: (args.date as string) ?? today,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: false,
    });
  },
};
