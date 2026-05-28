import { useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Trash2, RotateCcw } from 'lucide-react';
import { paiseToRupees } from '../../core/domain/money';
import type { Paise } from '../../core/domain/money';
import type { Transaction, BudgetStatusItem } from '../../core/domain/types';
import { CategoryIcon } from './categoryIcons';

interface TransactionCardProps {
  transaction: Transaction;
  budgetStatus?: BudgetStatusItem;
  onEdit: () => void;
  onDelete: () => void;
  onUndo: () => void;
}

const SWIPE_THRESHOLD = 60;

export function TransactionCard({ transaction, budgetStatus, onEdit, onDelete, onUndo }: TransactionCardProps) {
  const amount = paiseToRupees(transaction.amount as Paise);
  const isExpense = transaction.type === 'expense';
  const isDeleted = transaction.isDeleted;
  const time = format(new Date(transaction.createdAt), 'h:mm a');

  const budgetPercent = budgetStatus?.percentUsed ?? 0;
  const showBudget = isExpense && budgetStatus;

  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const [swiping, setSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [exiting, setExiting] = useState(false);

  const resetSwipe = useCallback(() => {
    setSwiping(false);
    setSwipeOffset(0);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleted || exiting) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDeleted || exiting) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx)) return;
    setSwiping(true);
    setSwipeOffset(dx);
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      triggerDelete();
    }
    resetSwipe();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDeleted || exiting) return;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDeleted || exiting) return;
    if (touchStartX.current === 0) return;
    const dx = e.clientX - touchStartX.current;
    const dy = e.clientY - touchStartY.current;
    if (Math.abs(dy) > Math.abs(dx)) return;
    setSwiping(true);
    setSwipeOffset(dx);
  };

  const handleMouseUp = () => {
    if (swiping && Math.abs(swipeOffset) > SWIPE_THRESHOLD) {
      triggerDelete();
    }
    resetSwipe();
  };

  const triggerDelete = () => {
    setExiting(true);
    setTimeout(() => {
      onDelete();
    }, 250);
  };

  const handleClick = () => {
    if (swiping || exiting) return;
    if (isDeleted) {
      onUndo();
    } else {
      onEdit();
    }
  };

  return (
    <div className={`transaction-card-wrapper ${exiting ? 'transaction-card--exiting' : ''} ${isDeleted && !exiting ? 'transaction-card--deleted' : ''}`}>
      <button className="transaction-card-delete-action" onClick={triggerDelete}>
        <Trash2 size={16} />
      </button>
      <button className="transaction-card-undo-action" onClick={onUndo}>
        <RotateCcw size={14} />
      </button>

      <div
        ref={cardRef}
        className={`transaction-card ${transaction.type} ${swiping ? 'swiping' : ''} ${exiting ? 'exiting' : ''} ${isDeleted ? 'deleted' : ''}`}
        style={swiping ? { transform: `translateX(${swipeOffset}px)` } : undefined}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={resetSwipe}
      >
        <CategoryIcon name={transaction.category} className="transaction-card-icon-img" />

        <div className="transaction-card-details">
          <div className="transaction-card-row-top">
            <span className="transaction-card-category">{transaction.category}</span>
            {transaction.tags && transaction.tags.length > 0 && (
              <span className="transaction-card-tags-inline">
                {transaction.tags.map((tag) => (
                  <span key={tag} className="transaction-card-tag">{tag}</span>
                ))}
              </span>
            )}
          </div>
          {(transaction.merchant || transaction.note) && (
            <div className="transaction-card-subtext">
              {transaction.merchant || transaction.note}
            </div>
          )}
          {showBudget && (
            <div className="transaction-card-budget">
              <div className="transaction-card-budget-bar">
                <div
                  className={`transaction-card-budget-fill ${budgetPercent >= 80 ? 'warn' : ''} ${budgetPercent >= 100 ? 'over' : ''}`}
                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                />
              </div>
              <span className="transaction-card-budget-label">
                {budgetPercent.toFixed(0)}% of budget
              </span>
            </div>
          )}
        </div>

        <div className="transaction-card-right">
          <div className="transaction-card-time">{time}</div>
          <div className="transaction-card-amount">
            {isExpense ? '-' : '+'}₹{amount.toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}
