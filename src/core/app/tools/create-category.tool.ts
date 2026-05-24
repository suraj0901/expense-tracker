import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { CreateCategorySchema } from '../../agent/tool-schemas';

export const createCategoryTool: ToolHandler = {
  name: 'create_category',
  schema: CreateCategorySchema,
  definition: {
    name: 'create_category',
    description: 'Create a new category. Call list_categories first — only create if no existing category fits. Avoid duplicates: "Pet Care" means no need for "Pets" or "Pet Food".',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name (e.g. "Pet Care", "Car Maintenance")' },
        icon: { type: 'string', description: 'Single emoji for the category' },
      },
      required: ['name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    return deps.categoryRepo.create(args.name as string, (args.icon as string) ?? '📦');
  },
};
