/**
 * DraftBanner — shows parsed SMS drafts for one-tap confirmation.
 *
 * Each draft shows extracted amount/merchant with "Log it" / "Dismiss" actions.
 * Log it → sends through processMessage pipeline.
 * Dismiss → removes from queue.
 */

import { Inbox, X } from 'lucide-react';
import { useDraftStore } from './drafts.store';
import type { DraftItem } from './types';

function formatDraftSummary(d: DraftItem): string {
  const parts: string[] = [];
  if (d.amount) parts.push(`₹${d.amount}`);
  if (d.merchant) parts.push(`at ${d.merchant}`);
  return parts.join(' ') || d.text.slice(0, 60);
}

export function DraftBanner({
  onLog,
  onDismiss,
}: {
  onLog: (draft: DraftItem) => void;
  onDismiss: (id: string) => void;
}) {
  const drafts = useDraftStore((s) => s.drafts);

  if (drafts.length === 0) return null;

  return (
    <div className="draft-banner">
      <div className="draft-banner-header">
        <Inbox size={14} />
        <span>{drafts.length} draft{drafts.length > 1 ? 's' : ''} ready</span>
      </div>
      {drafts.map((d) => (
        <div key={d.id} className="draft-item">
          <span className="draft-summary">{formatDraftSummary(d)}</span>
          <span className="draft-text">{d.text.slice(0, 80)}{d.text.length > 80 ? '…' : ''}</span>
          <div className="draft-actions">
            <button className="draft-btn log" onClick={() => onLog(d)}>Log it</button>
            <button className="draft-btn dismiss" onClick={() => onDismiss(d.id)}>
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
