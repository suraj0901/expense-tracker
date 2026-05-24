import { paiseToRupees } from '../../domain/money';
import type { Paise } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetCategoryBreakdownSchema } from '../../agent/tool-schemas';

export const getCategoryBreakdownTool: ToolHandler = {
  name: 'get_category_breakdown',
  schema: GetCategoryBreakdownSchema,
  definition: {
    name: 'get_category_breakdown',
    description: 'Get per-category spend totals for any date range.',
    parameters: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date YYYY-MM-DD' },
        end_date: { type: 'string', description: 'End date YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const breakdown = await deps.summaryRepo.getCategoryBreakdown(
      args.start_date as string, args.end_date as string,
    );
    return breakdown.map((c) => ({
      ...c, total: paiseToRupees(c.total as Paise),
    }));
  },
};
