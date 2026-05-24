import { useEffect, useState } from 'react';
import { transactionRepo } from '../../core/composition-root';
import { formatINR } from '../../core/domain/money';
import { CategoryIcon } from './categoryIcons';
import type { Transaction } from '../../core/domain/types';

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const load = () => {
    transactionRepo.getRecent(20).then(setTransactions).catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  if (transactions.length === 0) return null;

  return (
    <div className="recent-transactions">
      <div className="recent-header">
        <span className="recent-title">Recent transactions</span>
      </div>
      <div className="recent-list">
        {transactions.map((txn) => (
          <div key={txn.id} className="recent-item">
            <div className="recent-item-icon">
              <CategoryIcon name={txn.category} size={18} />
            </div>
            <div className="recent-item-details">
              <span className="recent-item-category">{txn.category}</span>
              {txn.merchant && <span className="recent-item-merchant">{txn.merchant}</span>}
            </div>
            <span className={`recent-item-amount ${txn.type}`}>
              {txn.type === 'income' ? '+' : '-'}{formatINR(txn.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
