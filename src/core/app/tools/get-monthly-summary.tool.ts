import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetMonthlySummarySchema } from '../../agent/tool-schemas';

export const getMonthlySummaryTool: ToolHandler = {
  name: 'get_monthly_summary',
  schema: GetMonthlySummarySchema,
  definition: {
    name: 'get_monthly_summary',
    description: 'Get aggregated totals and category breakdown for a specific month.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12)' },
        year: { type: 'number', description: 'Year (e.g. 2026)' },
      },
      required: ['month', 'year'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const summary = await deps.summaryRepo.getMonthlySummary(
      args.month as number, args.year as number,
    );
    return {
      ...summary,
      totalIncome: paiseToRupees(summary.totalIncome as Paise),
      totalExpense: paiseToRupees(summary.totalExpense as Paise),
      savings: paiseToRupees(summary.savings as Paise),
      categoryBreakdown: summary.categoryBreakdown.map((c) => ({
        ...c, total: paiseToRupees(c.total as Paise),
      })),
    };
  },
};
