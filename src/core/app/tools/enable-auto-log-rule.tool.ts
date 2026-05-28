import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { EnableAutoLogRuleSchema } from '../../agent/tool-schemas';
import { enableAutoLogRule } from '../../recurring';

export const enableAutoLogRuleTool: ToolHandler = {
  name: 'enable_auto_log_rule',
  schema: EnableAutoLogRuleSchema,
  definition: {
    name: 'enable_auto_log_rule',
    description: 'Enable an auto-log rule so transactions are created automatically.',
    parameters: {
      type: 'object',
      properties: {
        rule_id: { type: 'string', description: 'Rule ID from get_auto_log_rules' },
      },
      required: ['rule_id'],
    },
  },
  async execute(args, _deps: ToolDependencies) {
    enableAutoLogRule(args.rule_id as string);
    return { success: true, message: 'Auto-log rule enabled' };
  },
};
