/**
 * MessageBubble — renders a single chat message with tool badges.
 */

import { format } from 'date-fns';
import { Zap } from 'lucide-react';
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

          {import.meta.env.DEV && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="message-tools">
              {message.toolCalls.map((tc, i) => (
                <span key={i} className="tool-badge">
                  <Zap size={10} /> {tc.name.replace(/_/g, ' ')}
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
