/**
 * AutoLogRules — manage recurring auto-log rules in Settings.
 *
 * Rules are created when the user taps "Log it" on scheduler suggestions.
 * They start disabled — the user enables them here to opt into auto-logging.
 */

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import {
  getAutoLogRules, toggleAutoLogRule, removeAutoLogRule,
  type AutoLogRule,
} from '../../core/recurring';

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AutoLogRules() {
  const [rules, setRules] = useState<AutoLogRule[]>([]);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => setRules(getAutoLogRules()), []);
  useEffect(() => { refresh(); }, [refresh]);

  if (rules.length === 0) return null;

  const handleToggle = (id: string) => {
    const updated = toggleAutoLogRule(id);
    setRules(updated);
  };

  const handleRemove = (id: string) => {
    const updated = removeAutoLogRule(id);
    setRules(updated);
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="settings-section">
      <h2 onClick={() => setExpanded(!expanded)} style={{ cursor: 'pointer' }}>
        <RefreshCw size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
        Auto-Log Rules
        <span className="auto-log-badge">{enabledCount}/{rules.length} active</span>
      </h2>

      {expanded && (
        <div className="auto-log-list">
          {rules.map((rule) => (
            <div key={rule.id} className={`auto-log-rule ${rule.enabled ? 'enabled' : ''}`}>
              <div className="auto-log-rule-info">
                <span className="auto-log-rule-category">{rule.category}</span>
                <span className="auto-log-rule-amount">₹{rule.typicalAmount}</span>
                {rule.merchant && <span className="auto-log-rule-merchant">at {rule.merchant}</span>}
                <span className="auto-log-rule-time">
                  {rule.dayOfWeek !== null ? DOW_LABELS[rule.dayOfWeek] : 'Any day'}
                  {rule.hour !== null ? ` ~${rule.hour}:00` : ''}
                </span>
              </div>
              <div className="auto-log-rule-actions">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggle(rule.id)}
                  />
                  <span className="toggle-slider" />
                </label>
                <button
                  className="auto-log-remove"
                  onClick={() => handleRemove(rule.id)}
                  title="Remove rule"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}

          <p className="auto-log-hint">
            Auto-log rules are created when you accept spending pattern suggestions.
            Enable a rule to automatically log it when the scheduler detects the right time.
          </p>
        </div>
      )}
    </div>
  );
}
