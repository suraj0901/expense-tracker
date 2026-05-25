import { useEffect } from 'react';
import type { AutoLogRule } from '../../core/recurring';
import { useRecurringStore } from './recurring.store';

export function RecurringView() {
  const { pendingSuggestions, activeRules, dismissedHistory, isLoading, loadData, enableRule, disableRule, removeRule, dismissSuggestion, restoreRule } = useRecurringStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dayName = (d: number | null) => {
    if (d === null) return 'Any day';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d];
  };

  const renderRule = (rule: AutoLogRule & { dismissedAt?: number }, isActive: boolean) => (
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
        {isActive ? (
          <>
            <button className="rule-btn rule-btn-toggle" onClick={() => disableRule(rule.id)}>
              {rule.enabled ? 'Disable' : 'Enable'}
            </button>
            <button className="rule-btn rule-btn-remove" onClick={() => removeRule(rule.id)}>
              Remove
            </button>
          </>
        ) : 'dismissedAt' in rule ? (
          <button className="rule-btn rule-btn-restore" onClick={() => restoreRule(rule.id)}>
            Restore
          </button>
        ) : (
          <>
            <button className="rule-btn rule-btn-enable" onClick={() => enableRule(rule.id)}>
              Enable Rule
            </button>
            <button className="rule-btn rule-btn-remove" onClick={() => dismissSuggestion(rule.id)}>
              Dismiss
            </button>
          </>
        )}
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
            Pending Suggestions
            {pendingSuggestions.length > 0 && <span className="section-count">{pendingSuggestions.length}</span>}
          </h3>
          {pendingSuggestions.length === 0 ? (
            <p className="recurring-empty">No pending suggestions yet. Keep logging and patterns will appear.</p>
          ) : (
            pendingSuggestions.map(r => renderRule(r, false))
          )}
        </section>

        <section className="recurring-section">
          <h3 className="recurring-section-title">
            Active Rules
            {activeRules.length > 0 && <span className="section-count">{activeRules.length}</span>}
          </h3>
          {activeRules.length === 0 ? (
            <p className="recurring-empty">No active auto-log rules.</p>
          ) : (
            activeRules.map(r => renderRule(r, true))
          )}
        </section>

        <section className="recurring-section">
          <h3 className="recurring-section-title">Dismissed History</h3>
          {dismissedHistory.length === 0 ? (
            <p className="recurring-empty">No dismissed rules.</p>
          ) : (
            dismissedHistory.map(r => renderRule(r, false))
          )}
        </section>
      </div>
    </div>
  );
}
