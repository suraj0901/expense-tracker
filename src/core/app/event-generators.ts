import { nanoid } from 'nanoid';
import { paiseToRupees } from '../domain/money';
import type { Paise } from '../domain/money';
import type { EventRepository, GoalRepository, SummaryRepository } from './interfaces';

export async function checkBudgetWarnings(
  summaryRepo: SummaryRepository,
  eventRepo: EventRepository
): Promise<void> {
  try {
    const status = await summaryRepo.getBudgetStatus();
    for (const item of status.items) {
      if (item.percentUsed >= 80) {
        const remainingRupees = paiseToRupees(item.remaining as Paise);
        const budgetRupees = paiseToRupees(item.budgetAmount as Paise);
        await eventRepo.insert({
          id: nanoid(),
          type: 'budget_warning',
          title: `Budget alert: ${item.category}`,
          body: `You've used ${item.percentUsed}% of your ${item.category} budget (₹${budgetRupees} limit). ₹${remainingRupees} remaining.`,
          data: {
            category: item.category,
            percentUsed: item.percentUsed,
            remaining: item.remaining,
            budgetAmount: item.budgetAmount,
            spent: item.spent,
          },
          createdAt: Date.now(),
        });
      }
    }
  } catch {
    // Budget checks are best-effort — don't block anything
  }
}

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
