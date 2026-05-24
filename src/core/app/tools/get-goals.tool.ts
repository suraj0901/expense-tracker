import { paiseToRupees } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { GetGoalsSchema } from '../../agent/tool-schemas';

export const getGoalsTool: ToolHandler = {
  name: 'get_goals',
  schema: GetGoalsSchema,
  definition: {
    name: 'get_goals',
    description: 'List all goals with current progress.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async execute(_args, deps: ToolDependencies) {
    const goals = await deps.goalRepo.getAll();
    return goals.map((g) => ({
      ...g,
      targetAmount: paiseToRupees(g.targetAmount),
      currentAmount: paiseToRupees(g.currentAmount),
    }));
  },
};
