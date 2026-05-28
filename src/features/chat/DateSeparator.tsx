/**
 * DateSeparator — day dividers in the chat feed.
 */
import { format, isToday, isYesterday, differenceInCalendarDays } from 'date-fns';

export function DateSeparator({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  let label: string;

  if (isToday(date)) {
    label = 'Today';
  } else if (isYesterday(date)) {
    label = 'Yesterday';
  } else if (differenceInCalendarDays(new Date(), date) < 7) {
    label = format(date, 'EEEE');
  } else {
    label = format(date, 'd MMM yyyy');
  }

  return (
    <div className="date-separator">
      <span className="date-separator-label">{label}</span>
    </div>
  );
}

/** Returns a date key for grouping messages by day */
export function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
