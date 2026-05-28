import { useMemo } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { Marked } from 'marked';
import { useState } from 'react';

const marked = new Marked({ breaks: true, gfm: true });

interface QueryResponseCardProps {
  queryText: string;
  responseText: string;
  onDismiss: () => void;
}

export function QueryResponseCard({ queryText, responseText, onDismiss }: QueryResponseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const renderedResponse = useMemo(() => {
    return marked.parse(responseText) as string;
  }, [responseText]);

  const displayResponse = expanded
    ? responseText
    : responseText.length > 300
      ? responseText.slice(0, 300) + '…'
      : responseText;

  const renderedDisplay = useMemo(() => {
    return marked.parse(displayResponse) as string;
  }, [displayResponse]);

  return (
    <div className="query-response-card">
      <div className="query-response-header">
        <span className="query-response-label">You asked</span>
        <button className="query-response-dismiss" onClick={onDismiss}>
          <X size={14} />
        </button>
      </div>

      <div className="query-response-query">{queryText}</div>

      <div className="query-response-divider" />

      <div
        className="query-response-body markdown-body"
        dangerouslySetInnerHTML={{ __html: renderedDisplay }}
      />

      {responseText.length > 300 && (
        <button
          className="query-response-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <><ChevronUp size={14} /> Show less</>
          ) : (
            <><ChevronDown size={14} /> Show more</>
          )}
        </button>
      )}
    </div>
  );
}
