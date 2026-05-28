import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetAutoLogRulesSchema } from '../../agent/tool-schemas';
import { getAutoLogRules, getDismissedRules } from '../../recurring';

export const getAutoLogRulesTool: ToolHandler = {
  name: 'get_auto_log_rules',
  schema: GetAutoLogRulesSchema,
  definition: {
    name: 'get_auto_log_rules',
    description: 'List all auto-log rules (both active/pending and dismissed). Shows status, category, amount, merchant.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, _deps: ToolDependencies) {
    const active = getAutoLogRules();
    const dismissed = getDismissedRules();
    return {
      active: active.map((r) => ({
        id: r.id,
        category: r.category,
        typical_amount: r.typicalAmount,
        merchant: r.merchant,
        day_of_week: r.dayOfWeek,
        hour: r.hour,
        enabled: r.enabled,
        status: r.enabled ? 'active' : 'pending',
        created_at: r.createdAt,
      })),
      dismissed: dismissed.map((r) => ({
        id: r.id,
        category: r.category,
        typical_amount: r.typicalAmount,
        merchant: r.merchant,
        dismissed_at: r.dismissedAt,
      })),
    };
  },
};
