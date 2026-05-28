import { nanoid } from 'nanoid';
import type { EventRepository, GoalRepository } from './interfaces';

const MILESTONE_THRESHOLDS = [0.25, 0.5, 0.75, 1.0];

export async function checkGoalMilestones(
  goalRepo: GoalRepository,
  eventRepo: EventRepository
): Promise<void> {
  try {
    const goals = await goalRepo.getAll();
    for (const goal of goals) {
      if (goal.targetAmount <= 0) continue;
      const percent = goal.currentAmount / goal.targetAmount;
      for (const threshold of MILESTONE_THRESHOLDS) {
        if (percent >= threshold && percent - 0.01 < threshold) {
          const pct = Math.round(threshold * 100);
          await eventRepo.insert({
            id: nanoid(),
            type: 'goal_milestone',
            title: `${pct}% milestone: ${goal.name}`,
            body: pct === 100
              ? `Congratulations! You've reached your goal "${goal.name}"!`
              : `You're ${pct}% of the way to "${goal.name}"!`,
            data: {
              goalId: goal.id,
              goalName: goal.name,
              percent: pct,
              currentAmount: goal.currentAmount,
              targetAmount: goal.targetAmount,
            },
            createdAt: Date.now(),
          });
        }
      }
    }
  } catch {
    // Goal milestone checks are best-effort
  }
}
