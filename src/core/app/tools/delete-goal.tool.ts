import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { DeleteGoalSchema } from '../../agent/tool-schemas';

export const deleteGoalTool: ToolHandler = {
  name: 'delete_goal',
  schema: DeleteGoalSchema,
  definition: {
    name: 'delete_goal',
    description: 'Delete a goal by ID.',
    parameters: {
      type: 'object',
      properties: { goal_id: { type: 'string', description: 'Goal ID to delete' } },
      required: ['goal_id'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    return deps.goalRepo.delete(args.goal_id as string);
  },
};
