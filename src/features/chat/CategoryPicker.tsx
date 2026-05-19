/**
 * CategoryPicker — reusable bottom sheet for selecting a category.
 */
import { useEffect } from 'react';
import { DEFAULT_CATEGORIES } from '../../core/domain/types';
import { getCategoryIcon } from './categoryIcons';

interface CategoryPickerProps {
  open: boolean;
  selected: string | null;
  onSelect: (category: string) => void;
  onClose: () => void;
}

export function CategoryPicker({ open, selected, onSelect, onClose }: CategoryPickerProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="category-picker-overlay" onClick={onClose}>
      <div className="category-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="category-picker-handle" />
        <h3>Select Category</h3>
        <div className="category-picker-grid">
          {DEFAULT_CATEGORIES.map((cat) => {
            const Icon = getCategoryIcon(cat.name);
            return (
              <button
                key={cat.name}
                className={`category-picker-item ${selected === cat.name ? 'selected' : ''}`}
                onClick={() => onSelect(cat.name)}
              >
                <Icon className="category-picker-icon" />
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
