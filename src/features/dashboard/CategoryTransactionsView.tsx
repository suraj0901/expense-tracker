import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Pencil, Trash2, Undo2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { transactionRepo } from '../../core/composition-root';
import { formatINR, type Paise } from '../../core/domain/money';
import type { Transaction, BudgetStatusItem } from '../../core/domain/types';
import { CategoryIcon } from '../chat/categoryIcons';
import { EditTransactionModal } from '../chat/EditTransactionModal';

interface CategoryTransactionsViewProps {
  category: string;
  month: number;
  year: number;
  onBack: () => void;
  budget?: BudgetStatusItem;
}

export function CategoryTransactionsView({ category, month, year, onBack, budget }: CategoryTransactionsViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
  const [deleteUndo, setDeleteUndo] = useState<{ id: string; merchant: string; amount: Paise } | null>(null);

  const startDate = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const results = await transactionRepo.query({
        category,
        start_date: startDate,
        end_date: endDate,
        limit: 200,
      });
      setTransactions(results.filter((t) => !t.isDeleted));
    } catch (err) {
      console.error('[CategoryTransactions] Failed to load:', err);
    }
    setLoading(false);
  }, [category, startDate, endDate]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleDelete = async (txn: Transaction) => {
    try {
      await transactionRepo.softDelete(txn.id);
      setDeleteUndo({ id: txn.id, merchant: txn.merchant ?? '', amount: txn.amount });
      setTransactions((prev) => prev.filter((t) => t.id !== txn.id));
      setTimeout(() => {
        setDeleteUndo((curr) => (curr?.id === txn.id ? null : curr));
      }, 5000);
    } catch (err) {
      console.error('[CategoryTransactions] Delete failed:', err);
    }
  };

  const handleUndoDelete = async () => {
    if (!deleteUndo) return;
    try {
      await transactionRepo.undoDelete(deleteUndo.id);
      setDeleteUndo(null);
      await loadTransactions();
    } catch (err) {
      console.error('[CategoryTransactions] Undo failed:', err);
    }
  };

  const total = transactions.reduce((sum, t) => sum + t.amount, 0 as Paise);

  const barColor = budget
    ? budget.percentUsed >= 100
      ? 'var(--color-danger)'
      : budget.percentUsed >= 75
        ? 'var(--color-warning)'
        : 'var(--color-accent)'
    : undefined;

  if (loading) {
    return (
      <div className="drilldown-container">
        <div className="drilldown-header">
          <button className="drilldown-back" onClick={onBack}><ArrowLeft size={20} /></button>
          <CategoryIcon name={category} className="cat-icon" />
          <div className="drilldown-header-info">
            <span className="drilldown-title">{category}</span>
          </div>
        </div>
        <div className="drilldown-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '44px', marginBottom: '8px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="drilldown-container">
      <div className="drilldown-header">
        <button className="drilldown-back" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft size={20} />
        </button>
        <CategoryIcon name={category} className="cat-icon" />
        <div className="drilldown-header-info">
          <span className="drilldown-title">{category}</span>
          <span className="drilldown-subtitle">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
        </div>
        <span className="drilldown-header-total">{formatINR(total as Paise)}</span>
      </div>

      {budget && (
        <div className="drilldown-budget-section">
          <div className="budget-bar budget-bar--large">
            <div
              className="budget-bar-fill"
              style={{
                width: `${Math.min(budget.percentUsed, 100)}%`,
                background: barColor,
              }}
            />
          </div>
          <div className="drilldown-budget-meta">
            <span>{formatINR(budget.spent)} of {formatINR(budget.budgetAmount)} budget</span>
            <span>{budget.percentUsed.toFixed(0)}% used</span>
          </div>
        </div>
      )}

      {deleteUndo && (
        <div className="undo-toast">
          <span>Deleted {deleteUndo.merchant ? `"${deleteUndo.merchant}"` : 'transaction'} — {formatINR(deleteUndo.amount)}</span>
          <button onClick={handleUndoDelete}>
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="drilldown-empty">
          <p>No transactions in {category} for {format(new Date(year, month - 1), 'MMM yyyy')}</p>
        </div>
      ) : (
        <div className="drilldown-list">
          {transactions.map((txn) => (
            <div key={txn.id} className="drilldown-item">
              <div className="drilldown-item-left">
                <div className="drilldown-item-date">{format(new Date(txn.date), 'dd MMM')}</div>
                <div className="drilldown-item-primary">
                  {txn.merchant || txn.description || txn.note || 'Untitled'}
                </div>
                {(txn.merchant && (txn.description || txn.note)) && (
                  <div className="drilldown-item-secondary">
                    {txn.description || txn.note}
                  </div>
                )}
              </div>
              <div className="drilldown-item-right">
                <span className="drilldown-item-amount">{formatINR(txn.amount)}</span>
                <button
                  className="drilldown-item-action"
                  onClick={() => setEditingTxn(txn)}
                  aria-label="Edit transaction"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="drilldown-item-action drilldown-item-action--danger"
                  onClick={() => handleDelete(txn)}
                  aria-label="Delete transaction"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingTxn && (
        <EditTransactionModal
          item={{
            kind: 'event',
            event: {
              id: `drilldown-edit-${editingTxn.id}`,
              type: 'transaction_logged',
              title: `Edit ${editingTxn.category}`,
              body: '',
              data: { transactionId: editingTxn.id, category: editingTxn.category, merchant: editingTxn.merchant },
              status: 'pending',
              createdAt: editingTxn.createdAt,
              actedAt: null,
            },
            timestamp: editingTxn.createdAt,
          }}
          onClose={() => setEditingTxn(null)}
          onSaved={() => {
            setEditingTxn(null);
            loadTransactions();
          }}
        />
      )}
    </div>
  );
}
