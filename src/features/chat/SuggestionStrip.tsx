/**
 * SuggestionStrip — horizontal scrollable chips for one-tap logging.
 *
 * Chips start as generic defaults and become personalized over time
 * using the scoring algorithm from src/core/suggestions.ts.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { transactionRepo } from '../../core/composition-root';
import { rupeesToPaise } from '../../core/domain/money';
import { getPersonalizedChips } from '../../core/suggestions';
import type { Chip } from '../../core/domain/types';
import { CategoryIcon } from './categoryIcons';

interface SuggestionStripProps {
  isCollapsed: boolean;
  dismissedIds: string[];
  onDismiss: (id: string) => void;
  onLogged: () => void;
  refreshTrigger: number;
}

export function SuggestionStrip({ isCollapsed, dismissedIds, onDismiss, onLogged, refreshTrigger }: SuggestionStripProps) {
  const [chips, setChips] = useState<Chip[]>([]);
  const [logging, setLogging] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const initialLoadDone = useRef(false);

  const loadChips = useCallback(async () => {
    const dismissedSet = new Set(dismissedIds);
    const result = await getPersonalizedChips(dismissedSet);
    setChips(result);
  }, [dismissedIds]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadChips();
    }
  }, [loadChips]);

  useEffect(() => {
    if (refreshTrigger > 0) loadChips();
  }, [refreshTrigger, loadChips]);

  const handleLog = useCallback(async (chip: Chip) => {
    if (!chip.category || chip.amount === undefined) return;
    setLogging(chip.id);
    try {
      const id = nanoid();
      const today = new Date().toISOString().slice(0, 10);
      await transactionRepo.insert({
        id, amount: rupeesToPaise(chip.amount), type: 'expense',
        category: chip.category, merchant: chip.merchant ?? null,
        note: null, description: null, tags: undefined,
        date: today, createdAt: Date.now(), updatedAt: Date.now(), isDeleted: false,
      });
      onLogged();
    } catch {
      // silent
    } finally {
      setLogging(null);
    }
  }, [onLogged]);

  const handleDismiss = useCallback((chip: Chip) => {
    onDismiss(chip.id);
    setChips(prev => prev.filter(c => c.id !== chip.id));
  }, [onDismiss]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent, chip: Chip) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      handleDismiss(chip);
    }
  };

  if (isCollapsed || chips.length === 0) return null;

  return (
    <div className="suggestion-strip">
      <div className="suggestion-strip-scroll">
        {chips.map((chip) => (
          <button
            key={chip.id}
            className={`suggestion-chip-action ${logging === chip.id ? 'logging' : ''}`}
            onClick={() => handleLog(chip)}
            onTouchStart={handleTouchStart}
            onTouchEnd={(e) => handleTouchEnd(e, chip)}
            disabled={logging === chip.id}
          >
            {logging === chip.id ? (
              <span className="chip-spinner" />
            ) : (
              <>
                {chip.category && <CategoryIcon name={chip.category} className="chip-icon" />}
                <span className="chip-label">
                  ₹{chip.amount} {chip.label || chip.category}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
