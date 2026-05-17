/**
 * SmartHeader — today's spend + month status, always visible above chat.
 */
import { useEffect, useState } from 'react';
import { getMonthlySummary, getRecent } from '../../core/db/client';
import { formatINRCompact } from '../../core/domain/money';
import type { Paise } from '../../core/domain/money';

interface HeaderData {
  todaySpend: Paise;
  monthSpend: Paise;
  monthLabel: string;
}

export function SmartHeader({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<HeaderData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const [recent, summary] = await Promise.all([
        getRecent(50),
        getMonthlySummary(month, year),
      ]);

      if (cancelled) return;

      const todayTotal = recent
        .filter((t) => t.date === today && t.type === 'expense')
        .reduce((sum, t) => sum + (t.amount as number), 0) as Paise;

      setData({
        todaySpend: todayTotal,
        monthSpend: summary.totalExpense,
        monthLabel: now.toLocaleString('default', { month: 'short' }),
      });
    }
    fetch();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (!data) {
    return (
      <div className="smart-header">
        <span className="smart-header-label skeleton-header">--</span>
      </div>
    );
  }

  const todayStr = data.todaySpend > 0 ? formatINRCompact(data.todaySpend) : '₹0';
  const monthStr = formatINRCompact(data.monthSpend);

  return (
    <div className="smart-header">
      <span className="smart-header-today">{todayStr} today</span>
      <span className="smart-header-sep">·</span>
      <span className="smart-header-month">
        {monthStr} this {data.monthLabel}
      </span>
    </div>
  );
}
