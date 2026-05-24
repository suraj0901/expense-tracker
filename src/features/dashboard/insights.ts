/**
 * AI-powered monthly insight generation.
 */
import type { AIProvider, ProviderMessage } from '../../core/providers/types';
import type { MonthlySummary, BudgetStatusItem } from '../../core/domain/types';
import type { Goal } from '../../core/domain/types';
import { formatINR, paiseToRupees } from '../../core/domain/money';
import type { Paise } from '../../core/domain/money';
import { logger } from '../../core/logger';

const INSIGHT_SYSTEM_PROMPT =
  `You are a personal finance insights engine. Given a user's monthly spending data, write 2-4 concise, specific sentences. Note trends, anomalies, or notable patterns. Compare to the previous month if provided. Mention goal progress if relevant. Be direct and factual — no greetings, no advice, no emojis. Currency in INR (₹).`;

export async function generateInsight(
  currentMonth: MonthlySummary,
  previousMonth: MonthlySummary | null,
  goals: Goal[],
  budgetStatus: { hasBudgets: boolean; items: BudgetStatusItem[] },
  provider: AIProvider,
): Promise<string> {
  const traceId = logger.startTrace('insights:generate', {
    month: currentMonth.month,
    year: currentMonth.year,
    hasPrevious: previousMonth !== null,
    goalsCount: goals.length,
  });

  try {
    const prompt = buildDataPrompt(currentMonth, previousMonth, goals, budgetStatus);
    const messages: ProviderMessage[] = [
      { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ];

    const response = await provider.chat(messages, []);
    const insight = response.content.trim();

    logger.endTrace(traceId, 'insights:generate', 'success', {
      insightLength: insight.length,
    });

    return insight;
  } catch (error) {
    logger.endTrace(traceId, 'insights:generate', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function buildDataPrompt(
  current: MonthlySummary,
  previous: MonthlySummary | null,
  goals: Goal[],
  budgetStatus: { hasBudgets: boolean; items: BudgetStatusItem[] },
): string {
  const monthName = new Date(current.year, current.month - 1).toLocaleString('en-US', { month: 'long' });
  let data = `Monthly data for ${monthName} ${current.year}:\n`;
  data += `- Income: ${formatINR(current.totalIncome)}\n`;
  data += `- Expenses: ${formatINR(current.totalExpense)}\n`;
  data += `- Saved: ${formatINR(current.savings)} (${current.savingsRate.toFixed(0)}%)\n`;

  if (current.categoryBreakdown.length > 0) {
    data += `\nTop spending categories:\n`;
    current.categoryBreakdown.slice(0, 5).forEach((c) => {
      data += `- ${c.icon} ${c.category}: ${formatINR(c.total)} (${c.percentage.toFixed(1)}%, ${c.count} transactions)\n`;
    });
  }

  if (previous) {
    const prevMonthName = new Date(previous.year, previous.month - 1).toLocaleString('en-US', { month: 'long' });
    const expenseDelta = paiseToRupees((current.totalExpense - previous.totalExpense) as Paise);
    const sign = expenseDelta >= 0 ? '+' : '';
    data += `\nPrevious month (${prevMonthName} ${previous.year}): spent ${formatINR(previous.totalExpense)}, saved ${previous.savingsRate.toFixed(0)}%.\n`;
    data += `Change in spending: ${sign}₹${expenseDelta.toFixed(0)}\n`;
  }

  if (goals.length > 0) {
    data += `\nActive goals:\n`;
    goals.forEach((g) => {
      const pct = g.targetAmount > 0 ? ((g.currentAmount / g.targetAmount) * 100).toFixed(0) : 0;
      data += `- ${g.name}: ${formatINR(g.currentAmount)} of ${formatINR(g.targetAmount)} (${pct}%)\n`;
    });
  }

  if (budgetStatus.hasBudgets && budgetStatus.items.length > 0) {
    data += `\nBudget status:\n`;
    budgetStatus.items.forEach((b) => {
      data += `- ${b.icon} ${b.category}: ${formatINR(b.spent)} of ${formatINR(b.budgetAmount)} (${b.percentUsed.toFixed(0)}% used)\n`;
    });
  }

  data += `\nWrite 2-4 insightful sentences about this data.`;
  return data;
}
