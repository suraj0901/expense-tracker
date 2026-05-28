import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetSpendingTrendSchema } from '../../agent/tool-schemas';
import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';

export const getSpendingTrendTool: ToolHandler = {
  name: 'get_spending_trend',
  schema: GetSpendingTrendSchema,
  definition: {
    name: 'get_spending_trend',
    description: 'Compare current month spending vs previous month. Shows income, expense, and percentage changes.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    const trend = await deps.summaryRepo.getSpendingTrend();
    return {
      current_month: {
        income: paiseToRupees(trend.current.income as Paise),
        expense: paiseToRupees(trend.current.expense as Paise),
      },
      previous_month: {
        income: paiseToRupees(trend.previous.income as Paise),
        expense: paiseToRupees(trend.previous.expense as Paise),
      },
      changes: trend.changes,
    };
  },
};
