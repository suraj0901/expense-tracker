import { useEffect } from 'react';
import type { AutoLogRule } from '../../core/recurring';
import { useRecurringStore } from './recurring.store';

export function RecurringView() {
  const { activeRules, isLoading, loadData, disableRule, removeRule } = useRecurringStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dayName = (d: number | null) => {
    if (d === null) return 'Any day';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];
  };

  const renderRule = (rule: AutoLogRule) => (
    <div className="rule-card" key={rule.id}>
      <div className="rule-card-main">
        <span className="rule-category">{rule.category}</span>
        <span className="rule-amount">₹{rule.typicalAmount}</span>
      </div>
      <div className="rule-card-meta">
        {rule.merchant ? `${rule.merchant} — ` : ''}
        {dayName(rule.dayOfWeek)} at {rule.hour}:00 ±1h
      </div>
      <div className="rule-card-actions">
        <button className="rule-btn rule-btn-toggle" onClick={() => disableRule(rule.id)}>
          {rule.enabled ? 'Disable' : 'Enable'}
        </button>
        <button className="rule-btn rule-btn-remove" onClick={() => removeRule(rule.id)}>
          Remove
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="chat-container">
        <div className="chat-empty">
          <div className="typing-indicator">
            <div className="dot" /><div className="dot" /><div className="dot" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container" style={{ overflow: 'auto' }}>
      <div className="recurring-view">
        <h2 className="recurring-title">Recurring</h2>

        <section className="recurring-section">
          <h3 className="recurring-section-title">
            Active Rules
            {activeRules.length > 0 && <span className="section-count">{activeRules.length}</span>}
          </h3>
          {activeRules.length === 0 ? (
            <p className="recurring-empty">No active auto-log rules.</p>
          ) : (
            activeRules.map(r => renderRule(r))
          )}
        </section>
      </div>
    </div>
  );
}
