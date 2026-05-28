import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteMerchantMappingSchema } from '../../agent/tool-schemas';

export const deleteMerchantMappingTool: ToolHandler = {
  name: 'delete_merchant_mapping',
  schema: DeleteMerchantMappingSchema,
  definition: {
    name: 'delete_merchant_mapping',
    description: 'Completely remove a merchant→category mapping. The AI will re-learn the merchant next time it appears.',
    parameters: {
      type: 'object',
      properties: {
        canonical_name: { type: 'string', description: 'Merchant name to forget (lowercase, from get_merchant_mappings)' },
      },
      required: ['canonical_name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    await deps.merchantHintRepo.delete(args.canonical_name as string);
    return { success: true, message: `Forgot merchant mapping for "${args.canonical_name}"` };
  },
};
