# Quick Tappable Suggestions During Expense Logging

## What we're building

A row of contextual quick-tap chips above the chat input that suggest the most likely expense the user is about to log. Suggestions start generic (time-of-day defaults) and become personalized as we collect more transaction data — based on what the user normally logs at this time on this day.

---

## Design

### Architecture

```
QuickSuggestionsEngine (new, sync, no AI)
  ├─ Queries SQLite via existing repos
  ├─ Returns SuggestionChip[] based on time context
  │
  ├─ Tier 1: Time-specific patterns (≥10 txns in this time window)
  ├─ Tier 2: Top categories/merchants overall (≥3 txns total)
  └─ Tier 3: Generic time-of-day defaults (new user)
  │
  └─ Refreshes: on page load, after each txn logged, on visibility change

ChatView
  └─ Renders <QuickSuggestions> above the textarea (always visible)
  └─ Passes engine results, onTap handler

QuickSuggestions component
  └─ Horizontal scrollable chip row
  └─ Each chip: tap → transactionRepo.insert() → refresh suggestions
  └─ Visual distinct from SuggestionStrip (subtler, inline)
```

### Tiered personalization

| Tier | Condition | Source | Example chips |
|------|-----------|--------|---------------|
| Tier 1 | ≥10 txns in current hour window (±1.5h, past 30 days) | Time-specific patterns with typical amounts | `₹15 ☕ Chai`, `₹25 🚗 Auto` |
| Tier 2 | ≥3 txns total, but not enough time-specific data | Top categories + top merchants merged | `☕ Chai`, `🍔 Food` |
| Tier 3 | <3 total txns (new user) | Static time-of-day defaults | Morning: `☕ Chai ₹15`, `🍳 Breakfast ₹80` |

**Time-of-day defaults (Tier 3):**
- 6-10: Chai/Coffee, Breakfast, Auto
- 10-14: Lunch, Snacks
- 14-18: Snacks, Tea, Auto
- 18-22: Dinner, Shopping
- 22-6: Snacks, Auto

**Day-of-week bonus (Tier 2+3):**
- Weekends: boost Dining out, Entertainment, Shopping

### Chip format

`[{icon}] {merchant} ₹{amount}` or `[{icon}] {category_name}` (when no amount pattern)

**Tap behavior:** Creates the transaction immediately via `transactionRepo.insert()`. Shows a subtle inline "Logged" feedback that auto-fades after 1.5s (no toast library needed, just a CSS animation on the chip).

---

## Files

### New files

**`src/core/suggestions/quickSuggestionsEngine.ts`**
- Export `generateQuickSuggestions()` — sync function, queries repos, returns `QuickSuggestionChip[]`
- Query strategy:
  - `transactionRepo.getRecent(200)` — scan for time-window matches in-memory
  - `merchantHintRepo.getTop(20)` — for merchant-based suggestions
  - Count frequencies, pick top 3-5
- Falls back through tiers internally
- Returns empty array gracefully on any error

**`src/features/chat/QuickSuggestions.tsx`**
- Horizontal scrollable row of `<button>` chips
- `onTap` prop: called with the selected chip's data
- Handles the "Logged" animation locally (state per chip)
- Uses existing CSS variables for consistency

### Modified files

**`src/features/chat/ChatView.tsx`**
- Import and render `<QuickSuggestions>` above the `<textarea>`, inside `chat-input-container`
- Maintain `quickSuggestions` state, refresh via `useEffect` + `refreshKey` counter
- Increment `refreshKey` after every successful transaction log (in `handleSend`, `SuggestionStrip.onLogged`, `undoDelete`)
- Pass `onTap` that calls `transactionRepo.insert()` + `triggerRefresh()`

**`src/features/chat/SuggestionStrip.tsx`**
- Accept `suggestions: Suggestion[]` instead of single `suggestion: Suggestion | null`
- Render multiple chips in the horizontal scroll
- Each chip independently dismissable — calls `dismissSuggestion(id)`

**`src/features/chat/EmptyState.tsx`**
- Replace 3 hardcoded chips with dynamic results from `generateQuickSuggestions()`
- Shows tier-3 defaults for new users (same engine, no data = generic defaults)

**`src/core/scheduler.ts`**
- Wrap each of the 3 phases in `tick()` in try/catch so one failure doesn't block others
- Add early-exit if `transactionRepo.getRecent(50)` returns empty (skip pattern detection)
- Add `debug` flag logging (console.debug, gated behind env or always-off by default)

**`src/features/chat/chat.css`**
- Add `.quick-suggestions` container (flex row, gap, overflow-x auto, padding)
- Add `.quick-suggestion-chip` button style (subtler than SuggestionStrip chips — smaller, lighter border)
- Add `.quick-suggestion-chip--logged` animation (brief green flash + fade)

**`src/core/composition-root.ts`**
- No structural changes — the engine uses already-exported repos (`transactionRepo`, `merchantHintRepo`)

---

## Verification

1. **New user flow** — clear all transactions. Open the app at 8 AM. You should see time-of-day defaults like "☕ Chai ₹15", "🍳 Breakfast ₹80", "🚗 Auto ₹25". Tap one → transaction appears in RecentTransactions, chips refresh.

2. **Personalization** — log 15 "☕ Chai ₹15" transactions across multiple days at 8-9 AM. At 8:30 AM the next day, quick suggestions should show "☕ Chai ₹15" as the first chip (with amount, tier 1).

3. **After logging** — tap a quick-suggest chip. The chip briefly flashes green ("Logged") then the row refreshes. The transaction is immediately visible in RecentTransactions (no page reload).

4. **Scheduler robustness** — empty the DB. Trigger a scheduler tick (via visibility change). No errors in console. Pattern detection phase should be skipped gracefully.

5. **SuggestionStrip still works** — wait for a scheduler suggestion (or force via `tick()`). Multiple chips render in the strip. Dismiss one individually. Others remain.

6. **Mobile** — horizontal scroll on the quick-suggest row works with touch. Chips don't overflow viewport width. First chip is partially visible to indicate scrollability.
