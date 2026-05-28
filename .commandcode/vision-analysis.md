# Vision Analysis — AI-First Expense Tracker

**Goal**: Move all heavy lifting to AI. Provide the right tools and prompts. Let AI handle everything. No wiring AI output to app code — use modern agentic patterns instead.

---

## Current State: ~70-75% Complete

The hard part is done — all 15 core operations are AI tools, system prompt IS product behavior, and there's an agentic multi-turn tool loop (up to 8 iterations). The remaining gap is completeness: moving non-AI preprocessing into the agent, eliminating direct DB calls from UI, and adding proactive agent patterns.

---

## Features From User's Perspective

### Core Logging
- Chat-based expense/income logging
- Voice input
- Auto-categorization from merchant/description
- Quick-log chips above chat input

### Intelligence
- **Merchant memory** — learns merchant→category, remembers forever
- **Recurring detection** — notices daily chai, weekly groceries, monthly rent
- **Budget warnings** — alerts at 60% threshold
- **Goal tracking** — progress, countdown, milestones
- **Monthly insights** — AI-generated spending observations

### Queries
- Natural language: "how much on food this month?", "August vs September"
- Formatted responses: tables, bold numbers, comparisons

### Convenience
- SMS/bank share parsing
- Edit, delete, undo
- Works offline (browser SQLite, local AI model)
- Provider choice: Claude, Gemini, DeepSeek, local model

---

## What "Rules" Means In This App

### 1. Auto-Log Rules (user-facing feature)
When the scheduler detects a pattern (e.g., chai every morning ~9 AM), it creates a rule capturing: merchant, category, typical amount, day of week, time window. If enabled, the app auto-logs that transaction within ±1 hour, with same-day deduplication. Users can enable, disable, dismiss, or restore rules.

**Schema** (`src/core/recurring.ts`):
```
AutoLogRule: { id, category, typicalAmount, merchant, dayOfWeek, hour, enabled, createdAt }
DismissedRule: AutoLogRule + { dismissedAt }
```

### 2. Behavioral Rules (system prompt)
Instructions embedded in the prompt telling AI *how* to behave — mandatory tool calls, confirmation format, category logic, voice rules. Not user-facing or persisted.

---

## Ideal Tool Count: 25

### Have (15)
| Domain | Tools |
|--------|-------|
| Transactions | `store_expense`, `store_income`, `update_expense`, `delete_expense`, `undo_delete`, `get_expenses`, `get_recent_transactions` |
| Categories | `list_categories`, `create_category` |
| Budgets | `get_budget_status` |
| Goals | `set_goal`, `get_goals`, `delete_goal` |
| Analytics | `get_monthly_summary`, `get_category_breakdown` |
| Rules | *none* |
| Merchants | *none* |
| Events | *none* |
| Insights | *none* |

### Missing (10)
| Tool | Unlocks |
|------|---------|
| `update_category` | "rename Food to Eating Out" |
| `delete_category` | "delete Misc" |
| `set_budget` | "set ₹5000 budget for Entertainment" |
| `get_budgets` | "what are my budgets?" |
| `delete_budget` | "remove Entertainment budget" |
| `get_spending_trend` | "am I spending more vs last month?" |
| `get_merchant_mappings` | "what merchants have I mapped?" |
| `update_merchant_mapping` | "change Dmart to Shopping" |
| `delete_merchant_mapping` | "forget Dmart" |
| `get_auto_log_rules` | "show my auto-log rules" |
| `enable_auto_log_rule` | "start auto-logging chai" |
| `disable_auto_log_rule` | "stop auto-logging chai" |
| `delete_auto_log_rule` | "remove chai rule" |
| `get_event_feed` | "what happened this week?" |
| `get_insights` | "any insights about my spending?" |

---

## Merchant Memory: What's Done vs Missing

| Capability | Status |
|---|---|
| Auto-learn merchant→category when transaction logged | ✅ Event bus upserts hint |
| Ask user "Is Dmart a grocery store?" | ⚠️ Only from scheduler (30-min interval, useCount ≥ 3). Not in real-time chat. |
| User accepts → auto-categorize forever | ✅ `confirmStrategy: 'auto'` |
| User picks "Always ask" → ask every time | ✅ `confirmStrategy: 'ask_always'` |
| User dismisses → never ask again | ❌ Dismiss only clears event card. No persistence. Scheduler re-asks when useCount hits 3 again. |

**Fix**: Add `'dismissed'` as 4th `confirmStrategy` value. Filter dismissed merchants from `checkMerchantConfidence()` and scheduler. Tell AI in prompt to skip dismissed merchants.

## Recurring Patterns: What's Done vs Missing

| Capability | Status |
|---|---|
| Detect patterns (3+ same category + similar amount) | ✅ Scheduler clustering |
| Suggestion chips above chat | ✅ Algorithmic scoring (freq × recency × time) |
| Tap chip → log | ✅ |
| Create auto-log rule from suggestion | ✅ (starts disabled) |
| Auto-log enabled rules (±1h window, dedup) | ✅ |
| Dismiss rule → never suggest again | ✅ (persisted DismissedRule) |
| Detect via AI instead of algorithm | ❌ Scheduler is pure clustering, no AI involved |
| AI initiates conversation about patterns | ❌ Purely reactive |

---

## Remaining Gaps (to reach ~95%)

1. **Fix merchant "never ask again"** — persist dismissed state, filter from detection
2. **Add 10 missing tools** — merchant CRUD, rule CRUD, budget writes, event feed query, insights query
3. **Eliminate direct DB calls from UI** — all mutations through AI tool loop
4. **Move pattern detection into AI** — periodic AI call: "Here are 50 transactions, find recurring patterns"
5. **Add proactive agent** — background agent that notices anomalies, initiates conversations
6. **Middleware pipeline** — refactor monolithic `agent.ts` into pluggable pipeline
7. **Better local model** — native function calling support instead of XML tag hacks

---

## Key Files

| File | Purpose |
|------|---------|
| `src/core/agent/agent.ts` | Agent loop, merchant confidence check, tool execution |
| `src/core/agent/system-prompt.ts` | Product behavior as prompt |
| `src/core/agent/tools.ts` | Tool definitions |
| `src/core/app/tool-registry.ts` | Open/Closed tool dispatch |
| `src/core/app/tools/*.ts` | Individual tool handlers |
| `src/core/scheduler.ts` | Pattern detection, auto-log execution |
| `src/core/recurring.ts` | Auto-log rules CRUD, dismissed rules |
| `src/core/db/schema.ts` | DB schema (merchant_hints.confirmStrategy) |
| `src/core/composition-root.ts` | Event bus wiring |
| `src/features/chat/ChatView.tsx` | UI event handlers (merchant confirm/dismiss) |
| `src/features/chat/event-cards/EventCard.tsx` | MerchantMappingCard, RecurringSuggestionCard |
| `src/core/suggestions.ts` | Chip personalization algorithm |
| `src/features/chat/SuggestionStrip.tsx` | Chip UI strip |
