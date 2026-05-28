import { useEffect, useRef } from 'react';
import type { FeedItem, BudgetStatusItem } from '../../core/domain/types';
import { DateSeparator } from './DateSeparator';
import { EventCard } from './event-cards/EventCard';
import { TransactionCard } from './TransactionCard';
import { QueryResponseCard } from './QueryResponseCard';
import './event-cards/EventFeed.css';

interface EventFeedProps {
  feed: FeedItem[];
  isLoading: boolean;
  budgetStatus: Map<string, BudgetStatusItem>;
  onDismissEvent: (id: string) => void;
  onActEvent: (id: string, action: string) => void;
  onEditEvent: (item: FeedItem) => void;
  onDeleteTransaction: (txnId: string, label: string) => void;
  onUndoDelete: (txnId: string) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function EventFeed({
  feed, isLoading, budgetStatus, onDismissEvent, onActEvent, onEditEvent,
  onDeleteTransaction, onUndoDelete, contentRef,
}: EventFeedProps) {
  const wasAtTop = useRef(true);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      wasAtTop.current = el.scrollTop < 60;
    };
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, [contentRef]);

  useEffect(() => {
    const el = contentRef.current;
    if (el && wasAtTop.current) {
      requestAnimationFrame(() => {
        el.scrollTop = 0;
      });
    }
  }, [feed.length, contentRef]);

  if (isLoading) {
    return (
      <div className="chat-empty">
        <div className="typing-indicator">
          <div className="dot" /><div className="dot" /><div className="dot" />
        </div>
      </div>
    );
  }

  if (feed.length === 0) return null;

  const items = feed;
  const dayKeys = items.map(item => ({ item, dayKey: getDayKey(item.timestamp) }));

  return (
    <div className="event-feed">
      {dayKeys.map(({ item, dayKey }, idx) => {
        const showSeparator = idx === 0 || dayKey !== dayKeys[idx - 1].dayKey;

        return (
          <div key={itemKey(item)}>
            {showSeparator && <DateSeparator timestamp={item.timestamp} />}
            {item.kind === 'transaction' && item.transaction && (
              <TransactionCard
                transaction={item.transaction}
                budgetStatus={budgetStatus.get(item.transaction.category)}
                onEdit={() => onEditEvent(item)}
                onDelete={() => {
                  const t = item.transaction!;
                  const amt = (t.amount / 100).toFixed(0);
                  const label = t.merchant
                    ? `${t.category} ₹${amt} at ${t.merchant}`
                    : `${t.category} ₹${amt}`;
                  onDeleteTransaction(t.id, label);
                }}
                onUndo={() => onUndoDelete(item.transaction!.id)}
              />
            )}
            {item.kind === 'query-response' && item.event && (
              <QueryResponseCard
                queryText={item.queryText ?? ''}
                responseText={item.responseText ?? ''}
                onDismiss={() => onDismissEvent(item.event!.id)}
              />
            )}
            {item.kind === 'event' && item.event && (
              <EventCard
                event={item.event}
                onDismiss={onDismissEvent}
                onAct={onActEvent}
                onEdit={onEditEvent}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function itemKey(item: FeedItem): string {
  if (item.kind === 'transaction' && item.transaction) return `txn-${item.transaction.id}`;
  if (item.kind === 'query-response' && item.event) return `qr-${item.event.id}`;
  if (item.kind === 'event' && item.event) return `evt-${item.event.id}`;
  return `feed-${item.timestamp}-${Math.random()}`;
}
