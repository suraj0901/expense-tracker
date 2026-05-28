import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { UpdateMerchantMappingSchema } from '../../agent/tool-schemas';

export const updateMerchantMappingTool: ToolHandler = {
  name: 'update_merchant_mapping',
  schema: UpdateMerchantMappingSchema,
  definition: {
    name: 'update_merchant_mapping',
    description: 'Change the category or confirmation strategy for a merchant mapping.',
    parameters: {
      type: 'object',
      properties: {
        canonical_name: { type: 'string', description: 'The merchant name (lowercase, as shown by get_merchant_mappings)' },
        category: { type: 'string', description: 'New category for this merchant' },
        confirm_strategy: { type: 'string', description: "Confirmation strategy: 'auto', 'ask_always', or 'dismissed'" },
      },
      required: ['canonical_name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const fields: { category?: string; confirmStrategy?: string } = {};
    if (args.category) fields.category = args.category as string;
    if (args.confirm_strategy) fields.confirmStrategy = args.confirm_strategy as string;
    const ok = await deps.merchantHintRepo.update(args.canonical_name as string, fields);
    return { success: ok, message: ok ? 'Merchant mapping updated' : 'Merchant not found' };
  },
};
