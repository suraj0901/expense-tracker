import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteAutoLogRuleSchema } from '../../agent/tool-schemas';
import { removeAutoLogRule, restoreRule } from '../../recurring';

export const deleteAutoLogRuleTool: ToolHandler = {
  name: 'delete_auto_log_rule',
  schema: DeleteAutoLogRuleSchema,
  definition: {
    name: 'delete_auto_log_rule',
    description: 'Permanently delete an auto-log rule (active or dismissed).',
    parameters: {
      type: 'object',
      properties: {
        rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' },
      },
      required: ['rule_id'],
    },
  },
  async execute(args, _deps: ToolDependencies) {
    removeAutoLogRule(args.rule_id as string);
    // Also try to remove from dismissed
    try { restoreRule(args.rule_id as string); removeAutoLogRule(args.rule_id as string); } catch {}
    return { success: true, message: 'Auto-log rule deleted' };
  },
};
