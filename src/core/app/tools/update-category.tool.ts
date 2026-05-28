import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { UpdateCategorySchema } from '../../agent/tool-schemas';

export const updateCategoryTool: ToolHandler = {
  name: 'update_category',
  schema: UpdateCategorySchema,
  definition: {
    name: 'update_category',
    description: 'Rename a category or change its icon.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current category name' },
        new_name: { type: 'string', description: 'New name for the category' },
        icon: { type: 'string', description: 'New emoji icon' },
      },
      required: ['name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const updates: { name?: string; icon?: string } = {};
    if (args.new_name) updates.name = args.new_name as string;
    if (args.icon) updates.icon = args.icon as string;
    const ok = await deps.categoryRepo.update(args.name as string, updates);
    return { success: ok, message: ok ? 'Category updated' : 'Category not found or duplicate name' };
  },
};
