import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetMerchantMappingsSchema } from '../../agent/tool-schemas';

export const getMerchantMappingsTool: ToolHandler = {
  name: 'get_merchant_mappings',
  schema: GetMerchantMappingsSchema,
  definition: {
    name: 'get_merchant_mappings',
    description: 'List all known merchant→category mappings and their confirmation strategies.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    const hints = await deps.merchantHintRepo.getAll();
    if (hints.length === 0) return { mappings: [], message: 'No merchant mappings yet.' };
    return {
      mappings: hints.map((h) => ({
        merchant: h.canonicalName,
        category: h.category,
        usage_count: h.useCount,
        strategy: h.confirmStrategy,
      })),
    };
  },
};
