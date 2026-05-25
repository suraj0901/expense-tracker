/**
 * Monthly AI insight generation.
 *
 * Called by the scheduler on the 1st of each month (or last day).
 * Gathers data from repos, calls the AI provider, stores result.
 */
import { summaryRepo, insightRepo, goalRepo, merchantHintRepo, eventRepo } from './composition-root';
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import { getAutoLogRules } from './recurring';
import { nanoid } from 'nanoid';

const INSIGHT_SYSTEM_PROMPT = `You are a personal finance insights engine. Analyze the user's monthly spending data and write a 3-4 paragraph report.
Use markdown for formatting. Do NOT give financial advice — only observations.
Include specific numbers, percentages, and comparisons to the previous month.
Be constructive but factual.`;

export async function generateMonthlyInsight(
  month: number,
  year: number,
  generateText: (systemPrompt: string, dataPrompt: string) => Promise<string>
): Promise<string | null> {
  try {
    const [summary, goals, prevSummary] = await Promise.all([
      summaryRepo.getMonthlySummary(month, year),
      goalRepo.getAll(),
      summaryRepo.getMonthlySummary(month === 1 ? 12 : month - 1, month === 1 ? year - 1 : year),
    ]);

    const hints = await merchantHintRepo.getTop(10);
    const rules = getAutoLogRules();
    const activeRules = rules.filter(r => r.enabled);

    const totalIncome = paiseToRupees(summary.totalIncome as Paise);
    const totalExpense = paiseToRupees(summary.totalExpense as Paise);
    const prevExpense = paiseToRupees(prevSummary.totalExpense as Paise);
    const savings = paiseToRupees(summary.savings as Paise);
    const savingsRate = summary.savingsRate;

    const spendingDelta = prevExpense > 0
      ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100)
      : 0;

    const topCategories = summary.categoryBreakdown
      .map(c => ({
        category: c.category,
        total: Math.round(paiseToRupees(c.total as Paise)),
        percentage: Math.round(c.percentage),
        count: c.count,
      }));

    const activeGoals = goals.filter(g => paiseToRupees(g.targetAmount as Paise) > 0);
    const merchantCount = hints.length;
    const ruleCount = activeRules.length;

    const dataPrompt = `Month: ${month}/${year}

Income: ₹${totalIncome.toLocaleString('en-IN')}
Spent: ₹${totalExpense.toLocaleString('en-IN')}
Saved: ₹${savings.toLocaleString('en-IN')} (${savingsRate}%)
Previous month spent: ₹${prevExpense.toLocaleString('en-IN')} (${spendingDelta > 0 ? '+' : ''}${spendingDelta}%)

Top categories:
${topCategories.map(c => `- ${c.category}: ₹${c.total.toLocaleString('en-IN')} (${c.percentage}%, ${c.count} transactions)`).join('\n')}

${activeGoals.length > 0 ? `Goals:
${activeGoals.map(g => {
  const cur = Math.round(paiseToRupees(g.currentAmount as Paise));
  const tgt = Math.round(paiseToRupees(g.targetAmount as Paise));
  const pct = Math.round((cur / tgt) * 100);
  return `- ${g.name}: ₹${cur.toLocaleString('en-IN')} / ₹${tgt.toLocaleString('en-IN')} (${pct}%)${g.deadline ? ` deadline ${g.deadline}` : ''}`;
}).join('\n')}` : 'No active goals.'}

Personalization: ${merchantCount} merchant mappings learned, ${ruleCount} recurring patterns detected`;

    const text = await generateText(INSIGHT_SYSTEM_PROMPT, dataPrompt);
    if (!text) return null;

    await insightRepo.upsert(month, year, text);

    await eventRepo.insert({
      id: nanoid(),
      type: 'monthly_insight',
      title: `${new Date(year, month - 1).toLocaleString('en-US', { month: 'long' })} insights ready`,
      body: text.length > 200 ? text.slice(0, 200) + '…' : text,
      data: { month, year, fullText: text },
      createdAt: Date.now(),
    }).catch(() => {});

    return text;
  } catch {
    return null;
  }
}
