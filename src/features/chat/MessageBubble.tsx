/**
 * MessageBubble — renders a single chat message with tool badges.
 */

import { format } from 'date-fns';
import type { Message } from '../../core/domain/types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const time = format(new Date(message.createdAt), 'h:mm a');

  return (
    <div className={`message ${message.role}`}>
      <div className="message-body">
        <div className="message-bubble">
          <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>

          {message.toolCalls && message.toolCalls.length > 0 && (
            <div className="message-tools">
              {message.toolCalls.map((tc, i) => (
                <span key={i} className="tool-badge">
                  ⚡ {tc.name.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="message-time">{time}</div>
      </div>
    </div>
  );
}
