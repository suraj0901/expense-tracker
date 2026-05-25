# P1 Features — Implementation Plan

## Overview
All 7 P1 features from `feature.md`, built on top of the existing codebase. The codebase already has event cards, merchant hints, a scheduler, share-target parsing, recurring auto-log rules, and an onboarding screen — the P1 work extends and wires them into a cohesive system.

**Implementation order** respects dependencies: FB-09 (schema) first, then FB-08+02+11 (UI that depends on new schema), then FB-03 (new tab + routing), then FB-06 (report UI), then FB-01 (most isolated).

---

## Phase 1: FB-09 — Rich Transaction Metadata (Description & Tags)

### Schema Migration
**File: `src/core/db/schema.ts`**
- Add `description TEXT` column to `transactions` table
- Add new `transaction_tags` table:
  ```typescript
  export const transactionTags = sqliteTable('transaction_tags', {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id').notNull().references(() => transactions.id),
    tag: text('tag').notNull(),
  });
  ```
- Add indexes: `transaction_tags(transaction_id)`, `transaction_tags(tag)`

**File: `src/core/db/init.ts`**
- Add `CREATE TABLE IF NOT EXISTS transaction_tags` DDL
- Add `CREATE INDEX IF NOT EXISTS` for both indexes
- Add `ALTER TABLE transactions ADD COLUMN description TEXT` (idempotent — catch error if column exists)

### Domain Types
**File: `src/core/domain/types.ts`**
- Add to `Transaction` interface: `description: string | null; tags: string[];`
- Add `TransactionTag` type: `{ id: string; transactionId: string; tag: string; }`

### DB Write Paths
**File: `src/core/db/transactions-write.ts`**
- `InsertTransactionParams`: add `description?: string | null; tags?: string[]`
- `insertTransaction()`: insert description in transaction row, then insert tags
- `updateTransaction()`: update description; if tags provided, delete existing + re-insert

**New file: `src/core/db/transaction-tags.ts`**
- `getTagsForTransaction(transactionId)`, `deleteTagsForTransaction(transactionId)`, `insertTags(transactionId, tags)`

### DB Read Paths
**File: `src/core/db/transactions-read.ts`**
- `QueryTransactionsParams`: add `tags?: string[]`
- Join `transaction_tags` when tag filter present
- Return `description` and `tags` in all results

### Repository Interfaces
**File: `src/core/app/interfaces.ts`**
- Add `description?` and `tags?` to `InsertTransactionParams` and `UpdateTransactionParams`
- Add `tags?` to `QueryTransactionsParams`

### AI Tool Updates
**File: `src/core/agent/tool-schemas.ts`**
- Extend `StoreExpenseSchema`, `StoreIncomeSchema`, `GetExpensesSchema`, `UpdateExpenseSchema`

**Files: `src/core/app/tools/store-expense.tool.ts`, `store-income.tool.ts`, `get-expenses.tool.ts`, `update-expense.tool.ts`**
- Pass new fields through

**File: `src/core/agent/tools.ts`**
- Update JSON Schema definitions

**File: `src/core/agent/system-prompt.ts`**
- Add tags extraction rules

**File: `src/core/composition-root.ts`**
- Create `transactionTagRepo`, add to `ToolDependencies`

---

## Phase 2: FB-08 — Editable Transactions with Chat Context

**File: `src/features/chat/event-cards/EventCard.tsx`**
- Wire Edit button → EditTransactionModal
- Wire Delete button → softDelete with undo
- Wire "Include in chat" → add to includedItems

**New file: `src/features/chat/EditTransactionModal.tsx`**
- Modal: amount, category picker, merchant, note, description, tags, date
- Save → `transactionRepo.update()`, refresh feed

**File: `src/features/chat/chat.store.ts`**
- Add: `includedItems`, `deleteUndo`, `dismissedChips` state
- Add: `addIncludedItem`, `removeIncludedItem`, `clearIncludedItems`
- On send: prepend `[Attached: ...]` to message
- Add: `deleteTransaction` with undo timeout, `undoDelete`

**File: `src/features/chat/ChatView.tsx`**
- Show included-item chips above input

---

## Phase 3: FB-02 — AI Merchant Mapping with Confirmation

**File: `src/core/agent/system-prompt.ts`**
- Merchant mapping rules: known merchants → auto; new/ambiguous → ask

**File: `src/core/agent/agent.ts`**
- After `store_expense`: check merchant in hints, if unknown → insert `merchant_mapping_ask` event

**File: `src/core/db/schema.ts`**
- `merchant_hints` add `confirm_strategy TEXT` column (`auto` | `ask` | `ask_always`)

**File: `src/core/db/merchant-hints.ts`**
- `upsertHint()` supports `confirmStrategy`

**File: `src/features/chat/event-cards/EventCard.tsx`**
- `MerchantMappingCard`: historical context, "Yes always X", "Pick category", "Always ask", "Dismiss"

---

## Phase 4: FB-11 — Personalized Quick Suggestion Chips

**New file: `src/core/suggestions.ts`**
- Scoring: `recency × frequency × time-relevance`
- Boost from recurring rules
- Fallback: generic defaults if <10 transactions

**File: `src/core/domain/types.ts`**
- Add `Chip` type

**File: `src/features/chat/SuggestionStrip.tsx`**
- Load from `getPersonalizedChips()`
- Collapse when input has text, expand when empty
- One-tap → quick-log; long-press → edit; swipe → dismiss with undo

**File: `src/features/chat/chat.store.ts`**
- `dismissedChips` state, `loadChips()`, `dismissChip(id)`

---

## Phase 5: FB-03 — Recurring Auto-Log with History Tab

**File: `src/App.tsx`**
- Add `recurring` route, render `<RecurringView />`
- Add 4th nav button (Repeat icon)

**New file: `src/features/recurring/RecurringView.tsx`**
- Sections: Pending Suggestions, Active Rules, Dismissed History

**New file: `src/features/recurring/recurring.store.ts`**
- Zustand store for rule management

**File: `src/core/recurring.ts`**
- `getDismissedRules()`, `dismissRule()`, `restoreRule()`
- Check dismissed rules during suggestion dedup

---

## Phase 6: FB-06 — Monthly AI Insights & Report

**File: `src/core/scheduler.ts`**
- On 1st of month: trigger `generateMonthlyInsight()`

**New file: `src/core/insight-report.ts`**
- Gather data, call AI, store in `insightRepo`, create event

**New file: `src/features/dashboard/InsightReportView.tsx`**
- Formatted report view, month selector, PDF download

**File: `src/core/db/export.ts`**
- Add `exportInsightPDF()`

---

## Phase 7: FB-01 — SMS Transaction Detection & Notification

**File: `src/core/share-target.ts`**
- Additional regex patterns for bank SMS formats
- Dedup check against recent transactions

**File: `src/features/drafts/drafts.store.ts`**
- Add `source` field, `autoLog()` action

**File: `src/features/drafts/DraftBanner.tsx`**
- Show AI-auto-categorized preview: "Found: ₹120 at Dmart — Groceries?"

**New file: `src/core/platform/sms-detector.ts`**
- Platform detection, permission handling, notification hook
- Primary flow: Web Share Target (already implemented)

---

## Verification Checklist

### FB-09
- [ ] Log: "spent 120 on lunch at office with friends" → description + tags in DB
- [ ] Query: "how much did I spend at office" → returns tag-filtered results

### FB-08
- [ ] Edit transaction via event card → modal with fields → save updates
- [ ] Delete → soft-delete → undo toast
- [ ] Include in chat → context prepended to AI message

### FB-02
- [ ] New merchant → `merchant_mapping_ask` event
- [ ] Confirm mapping → hint upserted, future silent auto-categorize

### FB-11
- [ ] Empty history → default generic chips
- [ ] 5+ transactions → personalized chips
- [ ] Input focus → chips collapse

### FB-03
- [ ] Scheduler detects pattern → shows in Recurring tab
- [ ] Enable rule → moves to Active
- [ ] Dismiss → moves to history
- [ ] Restore from history → back to Active

### FB-06
- [ ] Month-end triggers insight generation
- [ ] View formatted report → PDF download works

### FB-01
- [ ] Share bank SMS → DraftBanner shows extracted data
- [ ] "Log it" → transaction saved
- [ ] Same SMS shared again → dedup prevents duplicate
