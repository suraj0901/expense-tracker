import { useEffect, useRef } from 'react';
import type { FeedItem } from '../../core/domain/types';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { EventCard } from './event-cards/EventCard';
import './event-cards/EventFeed.css';

interface EventFeedProps {
  feed: FeedItem[];
  isLoading: boolean;
  onDismissEvent: (id: string) => void;
  onActEvent: (id: string, action: string) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

function getDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function EventFeed({ feed, isLoading, onDismissEvent, onActEvent, contentRef }: EventFeedProps) {
  const wasAtBottom = useRef(true);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const check = () => {
      wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, [contentRef]);

  useEffect(() => {
    const el = contentRef.current;
    if (el && wasAtBottom.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
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
          <div key={`${item.kind}-${item.message?.id ?? item.event?.id}`}>
            {showSeparator && <DateSeparator timestamp={item.timestamp} />}
            {item.kind === 'message' && item.message && (
              <MessageBubble message={item.message} />
            )}
            {item.kind === 'event' && item.event && (
              <EventCard
                event={item.event}
                onDismiss={onDismissEvent}
                onAct={onActEvent}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
