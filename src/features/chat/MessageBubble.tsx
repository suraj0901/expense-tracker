/**
 * MessageBubble — renders a single chat message with tool badges.
 * Assistant messages are rendered as markdown when the content looks like a query response.
 */

import { useMemo } from 'react';
import { format } from 'date-fns';
import { Zap } from 'lucide-react';
import { Marked } from 'marked';
import type { Message } from '../../core/domain/types';

const marked = new Marked({ breaks: true, gfm: true });

interface MessageBubbleProps {
  message: Message;
}

function isMarkdownContent(content: string): boolean {
  return content.includes('|') || content.includes('#') || content.includes('**') || content.includes('```') || content.includes('* ') || content.includes('- ');
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const time = format(new Date(message.createdAt), 'h:mm a');

  const renderedContent = useMemo(() => {
    if (message.role === 'assistant' && isMarkdownContent(message.content)) {
      return marked.parse(message.content) as string;
    }
    return null;
  }, [message.content, message.role]);

  return (
    <div className={`message ${message.role}`}>
      <div className="message-body">
        <div className="message-bubble">
          {renderedContent ? (
            <div
              className="markdown-body"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          ) : (
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
          )}

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
