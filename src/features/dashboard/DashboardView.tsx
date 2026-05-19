/**
 * DashboardView — monthly summary, charts, and compare mode.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { format, subMonths, addMonths, differenceInDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Target, Sparkles, BarChart3 } from 'lucide-react';
import { formatINR, paiseToRupees } from '../../core/domain/money';
import type { Paise } from '../../core/domain/money';
import * as db from '../../core/db/client';
import type { MonthlySummary, CategoryBreakdownItem, BudgetStatusItem } from '../../core/domain/types';
import type { Goal } from '../../core/db/client';
import { logger } from '../../core/logger';
import { useSettingsStore } from '../settings/settings.store';
import { generateInsight } from './insights';
import { CategoryIcon } from '../chat/categoryIcons';

const CHART_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24',
  '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf',
  '#e879f9', '#f97316', '#22d3ee', '#84cc16',
];

interface CompareDatum {
  category: string;
  icon: string;
  [monthLabel: string]: number | string;
}

export function DashboardView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareData, setCompareData] = useState<CompareDatum[] | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [previousSummary, setPreviousSummary] = useState<MonthlySummary | null>(null);
  const [budgetStatus, setBudgetStatus] = useState<{ hasBudgets: boolean; items: BudgetStatusItem[] } | null>(null);
  const provider = useSettingsStore((s) => s.provider);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    const traceId = logger.startTrace('dashboard:loadSummary', { month, year });
    try {
      const [data, prevData, budgetData] = await Promise.all([
        db.getMonthlySummary(month, year),
        db.getMonthlySummary(
          subMonths(currentDate, 1).getMonth() + 1,
          subMonths(currentDate, 1).getFullYear(),
        ),
        db.getBudgetStatus(),
      ]);
      setSummary(data as MonthlySummary);
      setPreviousSummary(prevData as MonthlySummary);
      setBudgetStatus(budgetData);
      logger.endTrace(traceId, 'dashboard:loadSummary', 'success', {
        totalExpense: data.totalExpense,
        totalIncome: data.totalIncome,
        categories: data.categoryBreakdown.length,
      });
    } catch (error) {
      logger.endTrace(traceId, 'dashboard:loadSummary', 'error', {
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('[Dashboard] Failed to load summary:', error);
    }
    setIsLoading(false);
  }, [month, year, currentDate]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    db.getGoals().then(setGoals).catch(() => {});
  }, [month, year]);

  const now = new Date();
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();

  // Generate AI insight only for completed (past) months. Cache in DB so we
  // don't re-generate on every navigation. Current month shows static summary.
  useEffect(() => {
    if (!summary || !provider || !budgetStatus) return;

    const s = summary;
    const ps = previousSummary;
    const g = goals;
    const bs = budgetStatus;
    const p = provider;

    let cancelled = false;

    async function loadInsight() {
      if (isCurrentMonth) {
        setInsight(null);
        setInsightLoading(false);
        return;
      }

      setInsightLoading(true);
      setInsight(null);

      try {
        const cached = await db.getInsight(month, year);
        if (cached && !(await db.isInsightStale(month, year, cached.generatedAt))) {
          if (!cancelled) {
            setInsight(cached.text);
            setInsightLoading(false);
          }
          return;
        }

        const text = await generateInsight(s, ps, g, bs, p);
        if (!cancelled) {
          setInsight(text);
          db.upsertInsight(month, year, text).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) {
          logger.warn('dashboard:insightFailed', { error: err instanceof Error ? err.message : String(err) });
        }
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    }

    loadInsight();

    return () => { cancelled = true; };
  }, [summary, previousSummary, goals, budgetStatus, provider, isCurrentMonth, month, year]);

  const loadCompareData = useCallback(async () => {
    const months: { label: string; month: number; year: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = subMonths(currentDate, i);
      months.push({
        label: format(d, 'MMM'),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      });
    }
    const summaries = await Promise.all(
      months.map((m) => db.getMonthlySummary(m.month, m.year))
    );
    const catMap = new Map<string, CompareDatum>();
    summaries.forEach((s, i) => {
      const label = months[i].label;
      s.categoryBreakdown.forEach((c: CategoryBreakdownItem) => {
        const entry = catMap.get(c.category) || { category: c.category, icon: c.icon };
        entry[label] = paiseToRupees(c.total);
        catMap.set(c.category, entry);
      });
    });
    setCompareData(Array.from(catMap.values()));
  }, [currentDate]);

  useEffect(() => {
    if (compareMode) loadCompareData();
  }, [compareMode, loadCompareData]);

  const goToPrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const goToNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const monthLabel = format(currentDate, 'MMM yyyy');

  if (isLoading) {
    return (
      <div className="dashboard-container fade-in">
        <div className="dashboard-header">
          <h1>Dashboard</h1>
        </div>
        <div className="summary-cards">
          {[1, 2, 3].map((i) => (
            <div key={i} className="summary-card">
              <div className="skeleton" style={{ width: '48px', height: '10px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '64px', height: '18px' }} />
            </div>
          ))}
        </div>
        <div className="chart-card">
          <div className="skeleton" style={{ width: '100%', height: '180px' }} />
        </div>
      </div>
    );
  }

  const hasData = summary && (summary.totalExpense > 0 || summary.totalIncome > 0);

  return (
    <div className="dashboard-container fade-in">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="month-selector">
          <button onClick={goToPrevMonth} aria-label="Previous month">
            <ChevronLeft className="month-chevron" />
          </button>
          <span>{monthLabel}</span>
          <button onClick={goToNextMonth} aria-label="Next month">
            <ChevronRight className="month-chevron" />
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card income">
          <div className="label">Income</div>
          <div className="amount">{summary ? formatINR(summary.totalIncome) : '₹0'}</div>
        </div>
        <div className="summary-card expense">
          <div className="label">Spent</div>
          <div className="amount">{summary ? formatINR(summary.totalExpense) : '₹0'}</div>
        </div>
        <div className="summary-card savings">
          <div className="label">Saved</div>
          <div className="amount">{summary ? formatINR(summary.savings) : '₹0'}</div>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="goals-section">
          <h3><Target className="goals-icon" /> Goals</h3>
          <div className="goals-list">
            {goals.map((goal) => {
              const progress = goal.targetAmount > 0
                ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
                : 0;
              const daysLeft = goal.deadline
                ? differenceInDays(new Date(goal.deadline), new Date())
                : null;
              const isComplete = progress >= 100;
              return (
                <div key={goal.id} className={`goal-card ${isComplete ? 'complete' : ''}`}>
                  <div className="goal-header">
                    <span className="goal-name">
                      {goal.category ? `${goal.category} — ` : ''}{goal.name}
                    </span>
                    {isComplete && <span className="goal-badge">Done</span>}
                  </div>
                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="goal-meta">
                    <span>{formatINR(goal.currentAmount)} of {formatINR(goal.targetAmount)}</span>
                    <span className="goal-percent">{progress.toFixed(0)}%</span>
                  </div>
                  {daysLeft !== null && !isComplete && (
                    <div className="goal-deadline">
                      {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? 'Due today' : `${Math.abs(daysLeft)} days overdue`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasData ? (
        <>
          <div className="insight-card">
            <h3>
              {insight ? <Sparkles className="insight-icon" /> : null}
              {insight ? 'Monthly Insight' : 'Month Summary'}
            </h3>
            {insightLoading ? (
              <div className="skeleton" style={{ width: '100%', height: '40px' }} />
            ) : insight ? (
              <p>{insight}</p>
            ) : (
              <p>
                You saved {summary.savingsRate.toFixed(0)}% of your income this month.
                {summary.categoryBreakdown.length > 0 && (
                  <> Top spending category: {summary.categoryBreakdown[0].category} ({formatINR(summary.categoryBreakdown[0].total)}).</>
                )}
              </p>
            )}
          </div>

          <div className="compare-toggle-row">
            <h3>{compareMode ? '3-Month Comparison' : 'Spending by Category'}</h3>
            <button
              className={`compare-toggle ${compareMode ? 'active' : ''}`}
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? 'Single' : 'Compare'}
            </button>
          </div>

          {compareMode && compareData ? (
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={compareData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a42" />
                  <XAxis
                    dataKey="category" tick={{ fontSize: 11, fill: '#9595b0' }}
                    axisLine={{ stroke: '#2a2a42' }} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9595b0' }}
                    axisLine={{ stroke: '#2a2a42' }} tickLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e', border: '1px solid #2a2a42',
                      borderRadius: '8px', fontSize: '0.8rem',
                    }}
                    formatter={(value) => [formatINR(((value as number) * 100) as unknown as Paise), 'Amount']}
                  />
                  {(() => {
                    const months = compareData.length > 0
                      ? Object.keys(compareData[0]).filter((k) => k !== 'category' && k !== 'icon')
                      : [];
                    return months.map((m, i) => (
                      <Bar key={m} dataKey={m} fill={CHART_COLORS[i]} radius={[4, 4, 0, 0]} />
                    ));
                  })()}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            summary.categoryBreakdown.length > 0 && (
              <div className="chart-card">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={summary.categoryBreakdown}
                      cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                      paddingAngle={3} dataKey="total" nameKey="category" stroke="none"
                    >
                      {summary.categoryBreakdown.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#1a1a2e', border: '1px solid #2a2a42',
                        borderRadius: '8px', fontSize: '0.8rem',
                      }}
                      formatter={(value) => [formatINR(value as unknown as Paise), 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )
          )}

          <div className="chart-card">
            <h3>Category Breakdown</h3>
            <div className="category-list">
              {summary.categoryBreakdown.map((cat, i) => (
                  <div key={cat.category} className="category-item">
                    <CategoryIcon name={cat.category} className="cat-icon" />
                    <div className="cat-info">
                      <div className="cat-name">{cat.category}</div>
                      <div className="cat-count">{cat.count} transaction{cat.count !== 1 ? 's' : ''}</div>
                      <div className="progress-bar">
                        <div
                          className="fill"
                          style={{
                            width: `${cat.percentage}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="cat-amount">{formatINR(cat.total)}</div>
                      <div className="cat-percentage">{cat.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <BarChart3 className="icon" />
          <h3>No data for {monthLabel}</h3>
          <p>Start logging expenses in the chat to see your spending breakdown here.</p>
        </div>
      )}
    </div>
  );
}
