import { DateSeparator } from './DateSeparator';

export function SkeletonTransactionCard() {
  return (
    <>
      <DateSeparator timestamp={Date.now()} />
      <div className="skeleton-transaction-card">
        <div className="skeleton-icon shimmer" />
        <div className="skeleton-details">
          <div className="skeleton-line skeleton-line--short shimmer" />
          <div className="skeleton-line skeleton-line--long shimmer" />
        </div>
        <div className="skeleton-amount shimmer" />
      </div>
    </>
  );
}
