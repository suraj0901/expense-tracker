import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import type { FeedItem } from "@/core/domain/types";
import { transactionRepo } from "@/core/composition-root";
import { paiseToRupees, rupeesToPaise, type Paise } from "@/core/domain/money";
import { CategoryPicker } from "./CategoryPicker";

interface EditTransactionModalProps {
  item: FeedItem;
  onClose: () => void;
  onSaved: () => void;
}

export function EditTransactionModal({
  item,
  onClose,
  onSaved,
}: EditTransactionModalProps) {
  const event = item.event;
  const data = event?.data as Record<string, unknown> | null;
  const transactionId = (data?.transactionId as string) ?? "";

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState((data?.category as string) ?? "");
  const [merchant, setMerchant] = useState((data?.merchant as string) ?? "");
  const [note, setNote] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadTransaction = useCallback(async () => {
    if (!transactionId || loaded) return;
    try {
      const txn = await transactionRepo.getById(transactionId);
      if (txn) {
        setAmount(String(paiseToRupees(txn.amount as Paise)));
        setCategory(txn.category);
        setMerchant(txn.merchant ?? "");
        setNote(txn.note ?? "");
        setDescription(txn.description ?? "");
        setDate(txn.date);
        setTags(txn.tags ?? []);
      }
      setLoaded(true);
    } catch {
      setLoaded(true);
    }
  }, [transactionId, loaded]);

  useEffect(() => {
    loadTransaction();
  }, [loadTransaction]);

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleSave = async () => {
    setError(null);
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!category) {
      setError("Select a category");
      return;
    }
    if (!transactionId) {
      setError("No transaction to edit");
      return;
    }

    setSaving(true);
    try {
      await transactionRepo.update(transactionId, {
        amount: rupeesToPaise(amountNum),
        category,
        merchant: merchant || undefined,
        note: note || undefined,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        updatedAt: Date.now(),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Transaction</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-body">
          <div className="modal-field">
            <label>Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
            />
          </div>

          <div className="modal-field">
            <label>Category</label>
            <button
              className="modal-category-btn"
              onClick={() => setShowCategoryPicker(true)}
            >
              {category || "Select category..."}
            </button>
          </div>

          <div className="modal-field">
            <label>Merchant</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="Store or person"
            />
          </div>

          <div className="modal-field">
            <label>Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional note"
            />
          </div>

          <div className="modal-field">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Lunch at office with friends"
            />
          </div>

          <div className="modal-field">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="modal-field">
            <label>Tags</label>
            <div className="modal-tags">
              {tags.map((tag) => (
                <span key={tag} className="modal-tag">
                  {tag}
                  <button onClick={() => removeTag(tag)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                placeholder={tags.length === 0 ? "Add tag..." : ""}
                className="modal-tag-input"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="modal-btn-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <CategoryPicker
        open={showCategoryPicker}
        selected={category}
        onSelect={(cat) => {
          setCategory(cat);
          setShowCategoryPicker(false);
        }}
        onClose={() => setShowCategoryPicker(false)}
      />
    </div>
  );
}
