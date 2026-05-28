/**
 * Proactive agent — AI-driven pattern detection.
 *
 * Takes candidate patterns from the scheduler and uses the AI to
 * validate, enrich, and describe them in natural language.
 * Falls back to direct event creation if AI is unavailable.
 */

import type { AIProvider, ProviderMessage } from '../providers/types';
import type { Transaction } from '../domain/types';
import { paiseToRupees } from '../domain/money';
import type { Paise } from '../domain/money';
import { TOOL_DEFINITIONS } from './tools';

export interface PatternCandidate {
  category: string;
  amounts: number[];
  merchant: string | null;
}

export interface PatternFinding {
  type: 'recurring' | 'one_time' | 'anomaly';
  category: string;
  typicalAmount: number;
  merchant: string | null;
  confidence: number;
  reasoning: string;
  notificationBody: string;
}

function buildPatternDetectPrompt(candidates: PatternCandidate[], recentTxns: Transaction[]): string {
  const txnList = recentTxns.slice(0, 50).map((t) => {
    const amt = paiseToRupees(t.amount as Paise);
    return `${t.date} | ${t.category} | ₹${amt}${t.merchant ? ` at ${t.merchant}` : ''}`;
  }).join('\n');

  const candidateList = candidates.map((c) => {
    const avg = Math.round(c.amounts.reduce((s, a) => s + a, 0) / c.amounts.length);
    return `${c.category}${c.merchant ? ` at ${c.merchant}` : ''}: ${c.amounts.length} times, ~₹${avg}`;
  }).join('\n');

  return `You are in pattern detection mode. Analyze these transactions for recurring spending patterns.

RECENT TRANSACTIONS:
${txnList}

CANDIDATE PATTERNS DETECTED:
${candidateList}

For each candidate, determine if it's a true recurring pattern or a coincidence. Respond with ONLY a JSON array — no other text:
[{
  "type": "recurring" | "one_time" | "anomaly",
  "category": "category name",
  "typicalAmount": <number in rupees>,
  "merchant": "merchant name or null",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<one sentence about why this is or isn't a real pattern>",
  "notificationBody": "<short conversational sentence asking if user wants to log this or create a rule. Keep under 100 chars. Vary phrasing. Examples: 'Breakfast again? Want me to log your usual ₹200 at Cafe?', 'Rent time — should I create a recurring rule for ₹15,000?', 'Grocery run? Your usual ~₹500 at BigBasket — log it?'>"
}]

Only include candidates that are genuine patterns. Skip one-time or coincidental groupings. Be conservative — only mark as recurring if truly habitual.`;
}

export async function analyzePatterns(
  candidates: PatternCandidate[],
  recentTxns: Transaction[],
  provider: AIProvider
): Promise<PatternFinding[]> {
  if (!provider.isConfigured() || candidates.length === 0) return [];

  const messages: ProviderMessage[] = [
    { role: 'system', content: 'You are a pattern detection system. Respond ONLY with valid JSON arrays. No other text.' },
    { role: 'user', content: buildPatternDetectPrompt(candidates, recentTxns) },
  ];

  try {
    const response = await provider.chat(messages, []);
    const text = response.content.trim();

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || text.match(/^(\[[\s\S]*?\])$/);
    const json = jsonMatch ? jsonMatch[1] : text;

    const findings: PatternFinding[] = JSON.parse(json);

    return findings.filter((f) => f.type === 'recurring' && f.confidence > 0.3)
      .map((f) => ({
        ...f,
        notificationBody: f.notificationBody || `Recurring ~₹${f.typicalAmount} ${f.category}${f.merchant ? ` at ${f.merchant}` : ''} — want me to remember this?`,
      }));
  } catch {
    return [];
  }
}
