import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DisableAutoLogRuleSchema } from '../../agent/tool-schemas';
import { toggleAutoLogRule } from '../../recurring';

export const disableAutoLogRuleTool: ToolHandler = {
  name: 'disable_auto_log_rule',
  schema: DisableAutoLogRuleSchema,
  definition: {
    name: 'disable_auto_log_rule',
    description: 'Disable an auto-log rule. The rule will no longer create automatic transactions.',
    parameters: {
      type: 'object',
      properties: {
        rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' },
      },
      required: ['rule_id'],
    },
  },
  async execute(args, _deps: ToolDependencies) {
    toggleAutoLogRule(args.rule_id as string);
    return { success: true, message: 'Auto-log rule toggled' };
  },
};
