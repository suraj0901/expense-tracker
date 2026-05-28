import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteCategorySchema } from '../../agent/tool-schemas';

export const deleteCategoryTool: ToolHandler = {
  name: 'delete_category',
  schema: DeleteCategorySchema,
  definition: {
    name: 'delete_category',
    description: 'Delete a category. Only works on user-created categories (non-default).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name to delete' },
      },
      required: ['name'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const ok = await deps.categoryRepo.delete(args.name as string);
    return { success: ok, message: ok ? 'Category deleted' : 'Category not found' };
  },
};
