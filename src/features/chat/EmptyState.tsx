/**
 * EmptyState — capability showcase when no messages exist.
 * Renders faded example bubbles and one-tap action chips.
 */
import { nanoid } from 'nanoid';
import { insertTransaction } from '../../core/db/client';
import { rupeesToPaise } from '../../core/domain/money';

interface EmptyStateProps {
  onQuickLog: () => void;
}

const EXAMPLES = [
  { role: 'user' as const, content: 'spent 120 on lunch at haldirams' },
  { role: 'assistant' as const, content: 'Got it! Logged Food ₹120 at Haldiram\'s.' },
  { role: 'user' as const, content: 'how much on food this month?' },
  { role: 'assistant' as const, content: 'You\'ve spent ₹3,450 on Food in May — about 28% of your total expenses. Your top Food merchants are Haldiram\'s and Zomato.' },
];

const QUICK_ACTIONS = [
  { label: '☕ Chai ₹15', category: 'Food', amount: 15 },
  { label: '🚗 Auto ₹25', category: 'Transport', amount: 25 },
  { label: '🛒 Groceries ₹500', category: 'Groceries', amount: 500 },
];

export function EmptyState({ onQuickLog }: EmptyStateProps) {
  const handleQuickAction = async (category: string, amount: number) => {
    const id = nanoid();
    const today = new Date().toISOString().slice(0, 10);
    await insertTransaction({
      id, amount: rupeesToPaise(amount), type: 'expense',
      category, merchant: null, note: null, date: today,
      createdAt: Date.now(), updatedAt: Date.now(), isDeleted: false,
    });
    onQuickLog();
  };

  return (
    <div className="chat-empty">
      <div className="empty-hero">
        <h2>Your AI expense tracker</h2>
        <p>Log expenses, ask questions, get reports — all in plain English.</p>
      </div>

      <div className="empty-examples">
        {EXAMPLES.map((ex, i) => (
          <div key={i} className={`empty-example-bubble ${ex.role}`}>
            {ex.content}
          </div>
        ))}
      </div>

      <div className="empty-divider">
        <span>Try tapping one</span>
      </div>

      <div className="empty-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            className="empty-action-chip"
            onClick={() => handleQuickAction(action.category, action.amount)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
