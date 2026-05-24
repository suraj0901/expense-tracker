import { nanoid } from 'nanoid';
import { rupeesToPaise, paiseToRupees } from '../../domain/money';
import type { ToolHandler, ToolDependencies } from '../tool-registry';
import { SetGoalSchema } from '../../agent/tool-schemas';

export const setGoalTool: ToolHandler = {
  name: 'set_goal',
  schema: SetGoalSchema,
  definition: {
    name: 'set_goal',
    description: 'Create a new financial goal (savings target or spending limit).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Goal name (e.g. "Emergency Fund", "Vacation")' },
        target_amount: { type: 'number', description: 'Target amount in rupees' },
        category: { type: 'string', description: 'Optional category this goal applies to' },
        deadline: { type: 'string', description: 'Optional deadline YYYY-MM-DD' },
      },
      required: ['name', 'target_amount'],
    },
  },
  async execute(args, deps: ToolDependencies) {
    const goal = await deps.goalRepo.set({
      id: nanoid(),
      name: args.name as string,
      targetAmount: rupeesToPaise(args.target_amount as number),
      category: (args.category as string) ?? null,
      deadline: (args.deadline as string) ?? null,
    });
    return {
      ...goal,
      targetAmount: paiseToRupees(goal.targetAmount),
      currentAmount: paiseToRupees(goal.currentAmount),
    };
  },
};
