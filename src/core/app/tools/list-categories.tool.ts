import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { ListCategoriesSchema } from '../../agent/tool-schemas';

export const listCategoriesTool: ToolHandler = {
  name: 'list_categories',
  schema: ListCategoriesSchema,
  definition: {
    name: 'list_categories',
    description: 'List all available categories.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    const cats = await deps.categoryRepo.getAll();
    return cats.map((c) => ({ name: c.name, icon: c.icon }));
  },
};
