/**
 * SQLite goal repository — implements GoalRepository.
 */
import type { GoalRepository, NewGoalParams, GoalUpdateFields } from '../app/interfaces';
import type { Goal } from '../domain/types';
import { setGoal, getGoals, updateGoal, deleteGoal } from '../db/goals';

export function createGoalRepository(): GoalRepository {
  return {
    async set(goal: NewGoalParams): Promise<Goal> {
      return setGoal(goal);
    },
    async getAll(): Promise<Goal[]> {
      return getGoals();
    },
    async update(id: string, fields: GoalUpdateFields): Promise<Goal | null> {
      return updateGoal(id, fields);
    },
    async delete(id: string): Promise<boolean> {
      return deleteGoal(id);
    },
  };
}
