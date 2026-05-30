/**
 * SmartHeader — today's spend + month status, always visible above chat.
 */
import { useEffect, useState } from 'react';
import { summaryRepo, transactionRepo } from '../../core/composition-root';
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

      const [todayTxns, summary] = await Promise.all([
        transactionRepo.query({ start_date: today, end_date: today, limit: 1000 }),
        summaryRepo.getMonthlySummary(month, year),
      ]);

      if (cancelled) return;

      const todayTotal = todayTxns
        .filter((t) => t.type === 'expense')
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
        <span className="smart-header-skeleton">--</span>
      </div>
    );
  }

  const todayStr = data.todaySpend > 0 ? formatINRCompact(data.todaySpend) : '₹0';
  const monthStr = formatINRCompact(data.monthSpend);

  return (
    <div className="smart-header">
      <div className="smart-header-month-corner">
        <span className="smart-header-month-amount">{monthStr}</span>
        <span className="smart-header-month-label">this {data.monthLabel}</span>
      </div>
      <div className="smart-header-hero">
        <span className="smart-header-today">{todayStr}</span>
        <span className="smart-header-today-label">spent today</span>
      </div>
    </div>
  );
}
