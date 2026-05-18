/**
 * SuggestionStrip — horizontal scrollable chips for one-tap logging.
 */
import { useState, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { insertTransaction } from '../../core/db/client';
import { rupeesToPaise } from '../../core/domain/money';
import { DEFAULT_CATEGORIES } from '../../core/domain/types';
import { dismissSuggestion, type Suggestion } from '../../core/scheduler';
import { CategoryPicker } from './CategoryPicker';

interface SuggestionStripProps {
  suggestion: Suggestion | null;
  onClear: () => void;
  onLogged: () => void;
}

export function SuggestionStrip({ suggestion, onClear, onLogged }: SuggestionStripProps) {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [logging, setLogging] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const handleLog = useCallback(async (s: Suggestion) => {
    if (!s.category || s.typicalAmount === undefined) return;
    setLogging(s.id);
    try {
      const id = nanoid();
      const today = new Date().toISOString().slice(0, 10);
      await insertTransaction({
        id, amount: rupeesToPaise(s.typicalAmount), type: 'expense',
        category: s.category, merchant: s.merchant ?? null,
        note: null, date: today,
        createdAt: Date.now(), updatedAt: Date.now(), isDeleted: false,
      });
      dismissSuggestion(s.id);
      onClear();
      onLogged();
    } catch {
      // silent — don't interrupt the user
    } finally {
      setLogging(null);
    }
  }, [onClear, onLogged]);

  const handleQuickAdd = useCallback(async (category: string) => {
    setQuickAddOpen(false);
    // Quick-add: log a ₹0 placeholder that user can edit later via chat
    const id = nanoid();
    const today = new Date().toISOString().slice(0, 10);
    await insertTransaction({
      id, amount: rupeesToPaise(0), type: 'expense',
      category, merchant: null, note: 'quick add',
      date: today, createdAt: Date.now(), updatedAt: Date.now(), isDeleted: false,
    });
    onLogged();
  }, [onLogged]);

  const handleDismiss = useCallback((s: Suggestion) => {
    dismissSuggestion(s.id);
    onClear();
  }, [onClear]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, s: Suggestion) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      handleDismiss(s);
    }
  };

  if (!suggestion) return null;

  const icon = suggestion.category
    ? DEFAULT_CATEGORIES.find((c) => c.name === suggestion.category)?.icon ?? '📦'
    : null;

  return (
    <>
      <div className="suggestion-strip">
        <div className="suggestion-strip-scroll">
          {suggestion && (
            <button
              className={`suggestion-chip-action ${logging === suggestion.id ? 'logging' : ''}`}
              onClick={() => handleLog(suggestion)}
              onTouchStart={handleTouchStart}
              onTouchEnd={(e) => handleTouchEnd(e, suggestion)}
              disabled={logging === suggestion.id}
            >
              {logging === suggestion.id ? (
                <span className="chip-spinner" />
              ) : (
                <>
                  {icon && <span className="chip-icon">{icon}</span>}
                  <span className="chip-label">
                    {icon && suggestion.typicalAmount
                      ? `₹${suggestion.typicalAmount} ${suggestion.category}`
                      : suggestion.text}
                  </span>
                </>
              )}
            </button>
          )}
          <button className="suggestion-chip-add" onClick={() => setQuickAddOpen(true)}>
            <span className="chip-icon">+</span>
            <span className="chip-label">Add</span>
          </button>
        </div>
      </div>

      <CategoryPicker
        open={quickAddOpen}
        selected={null}
        onSelect={handleQuickAdd}
        onClose={() => setQuickAddOpen(false)}
      />
    </>
  );
}
