/**
 * DashboardView — header insight + charts.
 *
 * TanStack Query reads from local SQLite.
 * Recharts for the donut chart.
 */

import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { format, subMonths, addMonths } from 'date-fns';
import { formatINR } from '../../core/domain/money';
import type { Paise } from '../../core/domain/money';
import * as db from '../../core/db/client';
import type { MonthlySummary } from '../../core/domain/types';

const CHART_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24',
  '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf',
  '#e879f9', '#f97316', '#22d3ee', '#84cc16',
];

export function DashboardView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await db.getMonthlySummary(month, year);
      setSummary(data as MonthlySummary);
    } catch (error) {
      console.error('[Dashboard] Failed to load summary:', error);
    }
    setIsLoading(false);
  }, [month, year]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

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
              <div className="skeleton" style={{ width: '60px', height: '12px', marginBottom: '8px' }} />
              <div className="skeleton" style={{ width: '80px', height: '20px' }} />
            </div>
          ))}
        </div>
        <div className="chart-card">
          <div className="skeleton" style={{ width: '100%', height: '200px' }} />
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
          <button onClick={goToPrevMonth}>←</button>
          <span>{monthLabel}</span>
          <button onClick={goToNextMonth}>→</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card income">
          <div className="label">Income</div>
          <div className="amount">
            {summary ? formatINR(summary.totalIncome) : '₹0'}
          </div>
        </div>
        <div className="summary-card expense">
          <div className="label">Spent</div>
          <div className="amount">
            {summary ? formatINR(summary.totalExpense) : '₹0'}
          </div>
        </div>
        <div className="summary-card savings">
          <div className="label">Saved</div>
          <div className="amount">
            {summary ? formatINR(summary.savings) : '₹0'}
          </div>
        </div>
      </div>

      {hasData ? (
        <>
          {/* Savings Rate */}
          {summary.totalIncome > 0 && (
            <div className="insight-card">
              <h3>✨ Monthly Insight</h3>
              <p>
                You saved {summary.savingsRate.toFixed(0)}% of your income this month.
                {summary.categoryBreakdown.length > 0 && (
                  <> Top spending category: {summary.categoryBreakdown[0].icon}{' '}
                  {summary.categoryBreakdown[0].category} ({formatINR(summary.categoryBreakdown[0].total)}).</>
                )}
              </p>
            </div>
          )}

          {/* Category Donut Chart */}
          {summary.categoryBreakdown.length > 0 && (
            <div className="chart-card">
              <h3>Spending by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={summary.categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="total"
                    nameKey="category"
                    stroke="none"
                  >
                    {summary.categoryBreakdown.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1a1a2e',
                      border: '1px solid #2a2a42',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                    }}
                    formatter={(value: number) => [formatINR(value as unknown as Paise), 'Amount']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category Breakdown List */}
          <div className="chart-card">
            <h3>Category Breakdown</h3>
            <div className="category-list">
              {summary.categoryBreakdown.map((cat, i) => (
                <div key={cat.category} className="category-item">
                  <span className="cat-icon">{cat.icon}</span>
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
          <div className="icon">📊</div>
          <h3>No data for {monthLabel}</h3>
          <p>Start logging expenses in the chat to see your spending breakdown here.</p>
        </div>
      )}
    </div>
  );
}
