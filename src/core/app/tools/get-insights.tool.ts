import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetInsightsSchema } from '../../agent/tool-schemas';

export const getInsightsTool: ToolHandler = {
  name: 'get_insights',
  schema: GetInsightsSchema,
  definition: {
    name: 'get_insights',
    description: 'Get AI-generated monthly spending insights for a specific month. Defaults to current month.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'number', description: 'Month (1-12). Defaults to current month.' },
        year: { type: 'number', description: 'Year. Defaults to current year.' },
      },
      required: [],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const now = new Date();
    const month = (args.month as number) ?? now.getMonth() + 1;
    const year = (args.year as number) ?? now.getFullYear();
    const insight = await deps.insightRepo.get(month, year);
    if (!insight) return { insight: null, message: `No insights generated for ${year}-${String(month).padStart(2, '0')} yet.` };
    return { insight: { month, year, text: insight.text, generated_at: insight.generatedAt } };
  },
};
