import { WifiOff, Wifi, Loader2 } from 'lucide-react';
import { useMessageQueueStore } from './messageQueue.store';

export function OfflineBanner() {
  const { isOnline, isDraining, queue } = useMessageQueueStore();

  if (isOnline && queue.length === 0 && !isDraining) return null;

  if (!isOnline) {
    return (
      <div className="offline-banner">
        <WifiOff size={16} />
        <span>
          You're offline. {queue.length > 0 && (
            <strong>{queue.length} message{queue.length > 1 ? 's' : ''} queued</strong>
          )}
          {queue.length === 0 && 'Message will be queued until connection is restored.'}
        </span>
      </div>
    );
  }

  if (isDraining || queue.length > 0) {
    return (
      <div className="offline-banner reconnecting">
        <Loader2 size={16} className="reconnect-spinner" />
        <span>Sending queued messages... ({queue.length} remaining)</span>
      </div>
    );
  }

  if (isOnline) {
    return (
      <div className="offline-banner connected">
        <Wifi size={16} />
        <span>Back online! Messages sent.</span>
      </div>
    );
  }

  return null;
}

