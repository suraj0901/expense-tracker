/**
 * Personalized suggestion chips algorithm.
 *
 * Scores past spending patterns by recency, frequency, and time relevance.
 * Only shows suggestions from actual transaction history — no hardcoded defaults.
 */
import { paiseToRupees } from './domain/money';
import type { Paise } from './domain/money';
import type { Chip } from './domain/types';
import { transactionRepo } from './composition-root';


interface Pattern {
  category: string;
  merchant: string | null;
  amounts: number[];
  hours: number[];
  days: number[];
}

export async function getPersonalizedChips(dismissedIds: Set<string>): Promise<Chip[]> {
  try {
    const recent = await transactionRepo.getRecent(100);
    const expenses = recent.filter(t => t.type === 'expense');
    if (expenses.length < 2) {
      return [];
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    // Group by (category, merchant)
    const groups = new Map<string, Pattern>();
    for (const txn of expenses) {
      const key = `${txn.category}||${txn.merchant ?? ''}`;
      const p = groups.get(key) || { category: txn.category, merchant: txn.merchant, amounts: [], hours: [], days: [] };
      p.amounts.push(paiseToRupees(txn.amount as Paise));
      const d = new Date(txn.createdAt);
      p.hours.push(d.getHours());
      p.days.push(d.getDay());
      groups.set(key, p);
    }

    const chips: Chip[] = [];

    for (const [, pattern] of groups) {
      if (pattern.amounts.length < 2) continue;

      const avgAmount = Math.round(pattern.amounts.reduce((s, a) => s + a, 0) / pattern.amounts.length);

      // Frequency score: how many times in last 30 days
      const recentCount = expenses.filter(t => {
        if (t.category !== pattern.category) return false;
        if (pattern.merchant && t.merchant !== pattern.merchant) return false;
        return t.createdAt > thirtyDaysAgo;
      }).length;
      const freqScore = Math.min(recentCount / 10, 1);

      // Time relevance: how close the avg hour and day is to now
      const avgHour = pattern.hours.reduce((s, h) => s + h, 0) / pattern.hours.length;
      const hourDiff = Math.min(Math.abs(currentHour - avgHour), 24 - Math.abs(currentHour - avgHour));
      const timeScore = Math.exp(-hourDiff / 3); // decays with distance

      // Day relevance
      const dayScore = pattern.days.includes(currentDay) ? 1 : 0.5;

      const confidence = (freqScore * 0.5) + (timeScore * 0.3) + (dayScore * 0.2);
      if (confidence < 0.15) continue;

      const merchant = pattern.merchant ?? '';
      const label = merchant
        ? `${pattern.category} ${avgAmount} at ${merchant}`
        : `${pattern.category} ${avgAmount}`;

      chips.push({
        id: `chip-${pattern.category}-${merchant}-${avgAmount}`,
        label,
        category: pattern.category,
        amount: avgAmount,
        merchant: merchant || undefined,
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    chips.sort((a, b) => b.confidence - a.confidence);

    const result = chips
      .filter(c => !dismissedIds.has(c.id))
      .slice(0, 6);

    return result;
  } catch {
    return [];
  }
}
