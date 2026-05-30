import type { AppEvent } from '../../../core/domain/types';

interface EventCardProps {
  event: AppEvent;
  onDismiss: (id: string) => void;
  onAct: (id: string, action: string) => void;
}

export function EventCard({ event, onDismiss, onAct }: EventCardProps) {
  switch (event.type) {
    case 'recurring_suggestion':
      return <RecurringSuggestionCard event={event} onDismiss={onDismiss} onAct={onAct} />;
    case 'goal_milestone':
      return <GoalMilestoneCard event={event} onDismiss={onDismiss} onAct={onAct} />;
    case 'monthly_insight':
      return <MonthlyInsightCard event={event} onDismiss={onDismiss} onAct={onAct} />;
    case 'merchant_mapping_ask':
      return <MerchantMappingCard event={event} onDismiss={onDismiss} onAct={onAct} />;
    default:
      return null;
  }
}

function RecurringSuggestionCard({ event, onDismiss, onAct }: EventCardProps) {
  const d = event.data as Record<string, unknown> | null;
  return (
    <div className="event-card event-card--suggestion">
      <div className="event-card-header">
        <span className="event-card-icon">🔄</span>
        <span className="event-card-title">{event.title}</span>
        <button className="event-card-dismiss" onClick={() => onDismiss(event.id)}>×</button>
      </div>
      <div className="event-card-body">{event.body}</div>
      <div className="event-card-actions">
        <button className="event-card-btn event-card-btn--primary" onClick={() => onAct(event.id, 'log')}>
          Log ₹{d?.typicalAmount as number}
        </button>
        <button className="event-card-btn" onClick={() => onAct(event.id, 'create_rule')}>Create rule</button>
        <button className="event-card-btn" onClick={() => onDismiss(event.id)}>Dismiss</button>
      </div>
    </div>
  );
}

function GoalMilestoneCard({ event, onDismiss, onAct }: EventCardProps) {
  return (
    <div className="event-card event-card--milestone">
      <div className="event-card-header">
        <span className="event-card-icon">🎯</span>
        <span className="event-card-title">{event.title}</span>
        <button className="event-card-dismiss" onClick={() => onDismiss(event.id)}>×</button>
      </div>
      <div className="event-card-body">{event.body}</div>
      <div className="event-card-actions">
        <button className="event-card-btn event-card-btn--primary" onClick={() => onAct(event.id, 'view_goals')}>View goals</button>
        <button className="event-card-btn" onClick={() => onDismiss(event.id)}>Dismiss</button>
      </div>
    </div>
  );
}

function MonthlyInsightCard({ event, onDismiss, onAct }: EventCardProps) {
  return (
    <div className="event-card event-card--insight">
      <div className="event-card-header">
        <span className="event-card-icon">📊</span>
        <span className="event-card-title">{event.title}</span>
        <button className="event-card-dismiss" onClick={() => onDismiss(event.id)}>×</button>
      </div>
      <div className="event-card-body">{event.body}</div>
      <div className="event-card-actions">
        <button className="event-card-btn event-card-btn--primary" onClick={() => onAct(event.id, 'read_more')}>Read more</button>
        <button className="event-card-btn" onClick={() => onDismiss(event.id)}>Dismiss</button>
      </div>
    </div>
  );
}

function MerchantMappingCard({ event, onDismiss, onAct }: EventCardProps) {
  const d = event.data as Record<string, unknown> | null;
  const category = (d?.suggestedCategory as string) ?? 'this category';
  const historicalContext = d?.historicalContext as string | null;
  return (
    <div className="event-card event-card--merchant">
      <div className="event-card-header">
        <span className="event-card-icon">🏪</span>
        <span className="event-card-title">{event.title}</span>
        <button className="event-card-dismiss" onClick={() => onDismiss(event.id)}>×</button>
      </div>
      <div className="event-card-body">
        {event.body}
        {historicalContext && (
          <div className="event-card-context">{historicalContext}</div>
        )}
      </div>
      <div className="event-card-actions">
        <button className="event-card-btn event-card-btn--primary" onClick={() => onAct(event.id, `confirm:${category}`)}>
          Yes, always "{category}"
        </button>
        <button className="event-card-btn" onClick={() => onAct(event.id, 'pick_category')}>Pick category</button>
        <button className="event-card-btn" onClick={() => onAct(event.id, 'ask_always')}>Always ask</button>
        <button className="event-card-btn" onClick={() => onAct(event.id, 'never_ask')}>Never ask</button>
        <button className="event-card-btn" onClick={() => onDismiss(event.id)}>Dismiss</button>
      </div>
    </div>
  );
}
