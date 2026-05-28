# Expense Tracker — Features

An AI-powered expense tracker that runs entirely in the browser. No backend, no proxy — all data stays on-device in SQLite (OPFS).

---

## AI Agent

- **Natural language logging.** Type or speak what you spent ("spent 120 on lunch at haldirams") and the AI logs it instantly. No forms, no pickers.
- **Agentic tool-call loop.** The AI can make multiple tool calls per turn — query your history, check budgets, then log — all in one response.
- **Cross-session memory.** The app learns `merchant → category` mappings over time. Tell it "swiggy" is Food once, and it remembers forever.
- **Spending intent detection.** Regex-based guard ensures the AI never ignores a spending/earning message. If the AI forgets to log, a second reminder forces it.
- **Conversation history.** Last 20 messages sent as context to the AI, persisted in SQLite across sessions.

### AI Tools (15 total)

| Tool | What it does |
|------|-------------|
| `store_expense` | Log a new expense (amount, category, merchant, date, note) |
| `store_income` | Log a new income (amount, source, date, note) |
| `get_expenses` | Query transactions with filters (category, date range, merchant) |
| `get_monthly_summary` | Income, expenses, savings, and category breakdown for a month |
| `get_category_breakdown` | Per-category spend totals for any date range |
| `get_recent_transactions` | Last N transactions |
| `update_expense` | Edit a transaction (amount, category, merchant, note) |
| `delete_expense` | Soft-delete a transaction |
| `undo_delete` | Restore a soft-deleted transaction |
| `get_budget_status` | Current month spend vs. budget per category |
| `set_goal` | Create a savings/budget goal with optional deadline |
| `get_goals` | List all goals with progress |
| `delete_goal` | Remove a goal |
| `list_categories` | Show all categories with icons |
| `create_category` | Add a custom category with emoji icon |

### AI Behavior

- **Silent category selection.** The AI picks the best-fit category automatically. Only asks when genuinely ambiguous.
- **Budget awareness.** After logging, the AI checks budget status and warns when a category exceeds 60% of its limit.
- **Goal tracking.** Displays progress, counts down deadlines, celebrates 100% milestones.
- **No financial advice.** The AI never gives investment or financial planning advice. Currency always INR.
- **Voice-aware.** Handles filler words and misrecognitions from speech input gracefully.

---

## AI Providers (4 backends)

| Provider | Model | Notes |
|----------|-------|-------|
| **Anthropic** | Claude Sonnet 4 | Default. Forced tool use on first turn. |
| **Google** | Gemini 2.0 Flash | Forced function calling for 5 turns. |
| **DeepSeek** | deepseek-chat | OpenAI-compatible API. |
| **Local (WebLLM)** | Qwen 3.5 2B | Runs entirely on-device via WebGPU. ~1 GB model download. No API key needed. |

API keys stored in localStorage. Calls go direct from browser to provider.

---

## Chat Interface

- **Message feed** with auto-scroll and day separators (Today, Yesterday, weekday, or date).
- **SmartHeader** — always-visible bar showing today's spend and current month total.
- **Suggestion strip** — AI-detected spending patterns as tappable chips. One-tap "Log it" or swipe-to-dismiss.
- **Empty state** — example messages and quick-action chips: "Chai Rs15", "Auto Rs25", "Groceries Rs500".
- **Voice input** — Web Speech API with `en-IN` locale. Single-utterance, falls back gracefully.
- **Text input** — Enter to send, Shift+Enter for newline.
- **Tool call badges** — in dev mode, shows which AI tools were called per message.
- **Loading states** — typing indicator dots while AI is processing.
- **Error banner** — transient error display with auto-dismiss.

---

## Dashboard

- **Summary cards** — Income, Spent, and Saved for any month.
- **Month navigation** — browse through months with chevron buttons.
- **Spending by Category** — donut pie chart (Recharts) with 12-color palette and tooltips.
- **3-Month Comparison** — toggle to grouped bar chart comparing last 3 months per category.
- **Category breakdown list** — ordered by spend, with emoji icons, progress bars, counts, and percentages.
- **Goals section** — progress bars with percentage, formatted amounts, and deadline countdowns.
- **AI-powered monthly insights** — 2–4 sentence analysis of trends, anomalies, top categories, and savings rate. Cached in SQLite, regenerated only when data changes.
- **Empty state** — shown when no data exists for the selected month.

---

## Automation

### Pattern Detection Scheduler
Runs every 30 minutes (and on tab visibility change):
- Detects repeated spending patterns (same category + similar amount appearing 3+ times).
- Promotes merchant-to-category mappings when a merchant appears 3+ times.
- Browser push notifications for detected suggestions with "Log it" / "Dismiss" actions.

### Recurring Auto-Log
- Learns from suggestions you accept — tracks day-of-week and time-of-day patterns.
- Auto-creates transactions for enabled rules (±1 hour window, deduplicates same-day entries).
- Managed from Settings: enable/disable/remove individual rules.

---

## Share Target (SMS/Bank Notifications)

- Registered as an Android Web Share Target.
- Parses bank alert SMS shared from other apps — extracts amount, merchant, and date.
- Drafts queue with "Log it" / "Dismiss" buttons.
- Logging sends through the AI agent pipeline for categorization.

---

## Budgets & Goals

- **Category budgets** — set monthly spending limits per category. Budget status tool checks progress.
- **Financial goals** — name, target amount, optional category and deadline. Track current progress.
- **Progress visualization** — progress bars, percentages, formatted amounts, deadline countdowns.

---

## Data Management

### Export
- **CSV** — with BOM for Excel compatibility. Columns: Date, Type, Category, Merchant, Note, Amount.
- **PDF** — formatted report with totals summary and transaction table (via jsPDF).

### Backup & Restore
- **Manual backup** — full database dump as downloadable JSON (all 6 tables).
- **Restore from file** — upload a backup JSON to restore the entire database.
- **Auto-backup** — daily snapshots to localStorage, keeps last 7 days.
- **Auto-backup list** — view, restore, or delete individual backups from Settings.

---

## PWA (Progressive Web App)

- **Installable** — custom install prompt, `display: standalone`, `orientation: portrait-primary`.
- **Offline-ready** — all assets precached via Workbox. App works without network.
- **Service worker** — runtime caching for fonts, images, WASM, and navigation. Stale cache cleanup on activation.
- **Periodic background sync** — browser-initiated scheduler checks every 30 minutes.
- **Push notifications** — suggestions delivered as browser notifications with action buttons.
- **Update prompt** — banner when a new version is available, with Update/Dismiss actions.

---

## Settings

- Provider selection with radio cards (Anthropic, Gemini, DeepSeek, Local).
- API key management (password fields, Save/Remove per provider).
- WebLLM model download card with progress bar and status.
- Auto-log rules management (enable/disable/remove with pattern details).
- Export buttons (CSV, PDF).
- Backup controls (manual backup, restore from file, auto-backup list).
- Storage info (persisted status, usage/quota, storage type).
- Storage warnings when running in memory mode or near quota limit.

---

## Platform & Architecture

- **100% client-side** — no server, no proxy. AI calls go direct from browser.
- **SQLite via OPFS** — persistent relational database in the browser.
- **Money in paise** — all amounts stored as integer paise to avoid floating-point errors.
- **Soft deletes only** — transactions are never hard-deleted.
- **Cross-origin isolation** — COOP/COEP headers for OPFS support. Graceful fallback to in-memory mode.
- **Hash-based routing** — four tabs: Chat, Dashboard, Recurring, Settings.
- **Dark theme** — `#0a0a0f` background with Inter font.

---

## Feature Backlog

> Statuses: `🔴 Planned` → `🟡 In Discussion` → `🟠 Ready` → `🟢 In Progress` → `✅ Done`
> Priority: P0 (critical), P1 (high), P2 (medium), P3 (nice-to-have)

---

### FB-01 — SMS Transaction Detection & Notification

**Priority:** P1 | **Status:** ✅ Done

Track user's SMS messages in the background. When a transaction message (bank alert, UPI, card spend) is detected, fire a notification with AI-extracted amount, auto-categorized expense/income, merchant, and other useful info. Let user modify details via free-form input or quick "Log it" / "Dismiss" actions.

**Key points:**
- AI extracts amount, merchant, category, date from SMS text
- Auto-categorizes using existing merchant→category hints
- Notification shows extracted summary with edit option
- Quick actions: "Log it" (saves as-is), "Edit & Log" (opens free-form input), "Dismiss"
- Dismissed SMS should still be recorded so it's not re-notified

**Questions to resolve:**
- How to access SMS on Android vs iOS? (Android: SMS Retriever API or direct read permission; iOS: not possible natively — may need a companion app or manual share-target flow)
- Should we funnel SMS-detected transactions through the agent pipeline or log directly?
- What's the dedup strategy? (transaction ID from SMS? amount+merchant+time window?)

---

### FB-02 — AI Merchant Mapping with Confirmation

**Priority:** P1 | **Status:** ✅ Done

AI auto-categorizes and maps merchants (e.g., Dmart → Groceries, Rapido → Transport). When merchant mapping is ambiguous or confidence is low, AI proactively asks for confirmation via an event in the chat feed rather than silently guessing wrong.

**Key points:**
- High-confidence mappings: silent auto-categorization
- Low-confidence / new merchant: create an event card in chat asking user to confirm
- Confirmation options: pick from suggested categories, type custom, or "always ask for this merchant"
- All confirmations feed back into merchant_hints DB table
- Edge case: same merchant name used for different things (e.g., "Amazon" → Shopping or Amazon Pay → Utilities)

**Questions to resolve:**
- What's the confidence threshold for "ask user"?
- Should the mapping dialog show historical context ("You usually categorize Amazon as Shopping")?

---

### FB-03 — Recurring Auto-Log with History Tab

**Priority:** P1 | **Status:** ✅ Done

A dedicated "Recurring" tab in the UI showing all recurring auto-log suggestions. AI keeps a history of **all** suggestions — accepted AND dismissed — so it never repeats a previously dismissed suggestion. Uses historical data to improve future suggestions.

**Key points:**
- Separate "Recurring" tab in the bottom nav (Chat | Dashboard | Recurring | Settings)
- Shows pending suggestions, active rules, and dismissed history
- Each entry shows: pattern (merchant, amount, category, day-of-week, time-of-day), status (active/dismissed/pending), last occurrence
- Dismissal is permanent — same pattern won't be suggested again
- Active rules auto-log transactions within ±1 hour window
- Deduplication: no double-logging for same rule on same day
- User can re-activate a previously dismissed rule manually

**Questions to resolve:**
- How many occurrences before a pattern is "promoted" to a suggestion? (currently 3 in existing scheduler)
- Should user be able to create manual recurring rules (not just AI-suggested)?

---

### FB-04 — In-App Event Feed (Chat Tab Overhaul)

**Priority:** P0 | **Status:** ✅ Done

Redesign the Chat tab from a transaction-display feed into an **event feed**. Instead of showing raw transaction messages, show structured event cards: AI asks about merchant mapping, recurring log suggestions, budget warnings, goal milestones, monthly insights. Each event has contextual action buttons and edit options. This eliminates the need for a separate notification view since all notifications are important user-facing events.

**Key points:**
- Event types replace flat transaction display:
  - `transaction_logged` — "Logged ₹120 at Dmart (Groceries)" with Edit/Delete/Include-in-chat buttons
  - `merchant_mapping_ask` — "Is 'Rapido' Transport?" with Yes/No/Pick-category buttons
  - `recurring_suggestion` — "Log ₹30 for Chai? (usually 9 AM)" with Log/Dismiss/Edit buttons
  - `budget_warning` — "Food budget at 80% this month" with View-details button
  - `goal_milestone` — "Savings goal 50% reached!" with View-progress button
  - `monthly_insight` — "October insights ready" with View/Download buttons
  - `ai_query_response` — Markdown-formatted AI response
- Events are interactive: tap to expand, action buttons inline
- Transaction events have Edit/Delete/Include-in-chat actions
- "Include in chat" — attaches a transaction to the next message for AI context
- Event feed replaces the existing separate notification tray concept

**Questions to resolve:**
- Should events persist across sessions or clear on dismiss?
- How does the event feed coexist with the chat input? (chronological interleaving or separate sections?)
- What's the visual hierarchy? (timeline? cards? grouped by date?)

---

### FB-05 — Permission Onboarding Flow

**Priority:** P0 | **Status:** ✅ Done

First-time app open shows a mandatory permissions onboarding screen. User cannot proceed until all required permissions are granted. Clear messaging explains why each permission is needed.

**Key points:**
- Permissions to request: Notifications, Storage (OPFS persistence), SMS access
- Show one screen with all permissions listed, each with a "why needed" explanation
- Grant buttons trigger native permission prompts
- All must be granted before the "Get Started" button enables
- If user denies a permission, show a persistent message explaining the feature loss
- Re-check permissions on every app launch (for users who revoke later)

**Questions to resolve:**
- What's the fallback if SMS permission is permanently denied? (disable FB-01 gracefully?)
- Should Storage permission be mandatory if OPFS isn't available? (in-memory fallback with warning)
- Design for the onboarding UI: steps/wizard or single-screen checklist?

---

### FB-06 — Monthly AI Insights & Report

**Priority:** P1 | **Status:** ✅ Done

At month-end, AI generates a comprehensive insight report covering expenses, income, goals, budgets, trends, and how much the user's data has helped personalize the app. Notification is sent when the insight is ready. Viewable in a dedicated UI with a download option (PDF).

**Key points:**
- Trigger: last day of month or first day of next month (detected via scheduler)
- AI generates report with sections: Spending summary, Category breakdown, Budget adherence, Goal progress, Top merchants, Trends vs. previous month, Personalization stats
- Report rendered in a dedicated view (modal or separate tab section)
- Download as formatted PDF
- Notification: "Your October insights are ready!" — tap to open
- Insights cached in SQLite, regenerated only when underlying data changes
- Historical insight reports accessible (browse past months)

**Questions to resolve:**
- Should the insight be auto-generated or user-triggered?
- PDF template design — simple table or visual charts?
- What personalization stats are meaningful? (X merchant mappings learned, Y recurring patterns detected)

---

### FB-07 — Markdown AI Responses

**Priority:** P2 | **Status:** 🔴 Planned

When user asks a non-logging query (e.g., "how much did I spend on food last month?"), the AI should respond in well-formatted markdown. The chat renderer already supports markdown, but the system prompt should explicitly instruct the AI to use markdown formatting for query responses rather than plain text or raw tables.

**Key points:**
- Update system prompt: "When responding to queries (not logging), use markdown for formatting — tables, bold, lists as appropriate"
- Chat UI already renders markdown (verify renderer handles tables, code blocks, lists)
- Distinguish between logging confirmations (structured event cards → FB-04) and query responses (markdown)
- Ensure tool-call responses that contain data use markdown tables

**Questions to resolve:**
- None — straightforward prompt engineering change.

---

### FB-08 — Editable Transactions with Chat Context

**Priority:** P1 | **Status:** ✅ Done

Every transaction shown in the UI (event feed, dashboard list, category drill-down) has Edit and Delete actions. Additionally, transactions can be "included in chat" — attaching them as context for the next AI message so the user can ask questions about specific transactions.

**Key points:**
- Edit: opens inline form or modal to modify amount, category, merchant, note, date
- Delete: soft-delete with undo option (already exists via `delete_expense`/`undo_delete` tools)
- "Include in chat": adds transaction reference to the next message context (AI sees it as part of conversation)
- All three actions available via long-press or swipe on transaction items
- Edit history tracked? (currently no — consider adding `updated_at`)

**Questions to resolve:**
- Should "include in chat" pre-fill the input with something like "What category should this be?" or just silently attach context?
- Multiple transactions selectable for batch inclusion?

---

### FB-09 — Rich Transaction Metadata (Description & Tags)

**Priority:** P1 | **Status:** ✅ Done

Transactions should store as much detail as possible extracted from the user's message. In addition to amount/merchant/category, the AI should extract a **description** (human-readable summary) and **tags** (short, queryable labels) from the natural language input.

**Key points:**
- **Description:** Auto-extracted summary from the user message. Example: "breakfast 40 at office" → description: `"Breakfast at office"`. Stored as a free-text field on the transaction.
- **Tags:** Extracted context labels that make filtering easy. Example: "breakfast 40 at office" → tags: `["breakfast", "office"]`. Tags are lowercase, normalized, stored as a JSON array or separate table.
- Tags enable natural queries like:
  - "how much have I spent in office this week?"
  - "show me all breakfast expenses this month"
  - "how much did I spend with friends last weekend?"
- AI extracts tags from: location context (office, home, mall), meal type (breakfast, lunch, dinner, snacks), social context (with friends, team lunch, date), payment method if mentioned (upi, cash, card), occasion (birthday, travel, emergency)
- Tags should be suggested, not forced — AI uses best judgment
- Existing query tools (`get_expenses`, `get_category_breakdown`) should support filtering by tags
- Tags are distinct from categories: category = broad bucket (Food), tag = specific context (breakfast, office)
- Merchant→category mapping still works; tags are additive context

**Schema impact:**
- `transactions` table: add `description TEXT` column, add `tags TEXT` column (JSON array stored as text — SQLite doesn't have native arrays)
- Or: separate `transaction_tags` table (`transaction_id, tag`) for proper querying with indexes
- Prefer `transaction_tags` table for efficient `WHERE tag = 'office'` queries; JSON extraction in SQLite is slow

**Questions to resolve:**
- Max tags per transaction? (suggest 5–8)
- Should tags be a predefined set the AI picks from, or free-form? (free-form with AI dedup — "Office" and "office" should be the same tag)
- How aggressively should tags be suggested to users for editing? (event card could show extracted tags with an "edit tags" option)
- Tag cleanup: should we periodically suggest merging similar tags? ("office", "Office", "at office" → "office")

---

### FB-10 — Dashboard Category Drill-Down

**Priority:** P2 | **Status:** 🔴 Planned

Clicking a category in the Dashboard (pie chart segment or category breakdown list item) navigates to a filtered transaction list showing all transactions for that category in the selected month.

**Key points:**
- Click pie chart segment → filtered list
- Click category row in breakdown list → filtered list
- Filtered list shows: date, merchant, amount, description, tags — with Edit/Delete actions (FB-08)
- Back button to return to full dashboard
- URL state for shareability? (hash param: `#/dashboard?category=food&month=2024-10`)

**Questions to resolve:**
- New page/route or modal overlay?
- Should the filtered view support additional filters (date range, merchant) on top of category?

---

### FB-11 — Personalized Quick Suggestion Chips

**Priority:** P1 | **Status:** ✅ Done

Quick suggestion chips shown above the chat input that start generic but become increasingly personalized as the app learns user behavior. Accounts for time-of-day, day-of-week, and transaction history to surface the most likely next transactions.

**Key points:**
- Initial generic chips: "☕ Chai ₹15", "🛺 Auto ₹25", "🛒 Groceries ₹500", "🍕 Lunch ₹120"
- Personalization signals: time of day, day of week, recent transaction patterns, recurring rules
- Chips collapse/minimize when user starts typing in the input
- Chips expand when input is empty
- Max ~4-6 chips visible at once, horizontally scrollable if more
- One-tap: instantly logs the transaction (bypasses chat, uses event feed for confirmation — FB-04)
- Long-press: edit details before logging
- "Swipe left to dismiss" a chip (permanently or "not now"?)
- Chip suggestions should feel smart: "You usually get chai around 9 AM on weekdays"

**Questions to resolve:**
- What's the ranking algorithm? (recency × frequency × time-relevance?)
- Should dismissed chips come back after some cooldown?
- How to handle "I logged this manually but not via chip" — should the chip still appear?

---

### FB-12 — Event Persistence & History

**Priority:** P2 | **Status:** ✅ Done

Events from the event feed (FB-04) should persist across sessions. Dismissed events are archived but still queryable. The notification tray concept (FB-04 replaces it) means events are the primary interaction history — they need reliable persistence.

**Key points:**
- Events stored in SQLite (new `events` table or extend `messages` table)
- Undismissed events remain visible until acted upon
- Dismissed events move to an archive/history view
- Recurring auto-log suggestions (FB-03) reference event history for dedup
- Events survive page refresh and app restart
- Event table schema: `id, type, title, body, data (JSON), status (pending/dismissed/acted), created_at, acted_at`

**Questions to resolve:**
- Should events expire/auto-archive after N days?
- How does this relate to the existing `messages` table in the chat store?

---

## Discussion Points (Cross-Cutting)

1. **~~FB-04 + FB-01 + FB-02 + FB-03 interplay~~:** ✅ Resolved. A unified event pipeline is in place via the event bus in `composition-root`. All four features feed into the event system.

2. **~~Notification strategy~~:** ✅ Resolved. Browser push notifications for time-sensitive alerts (budget warnings); in-app event feed for everything else.

3. **~~Tab navigation~~:** ✅ Resolved. 4-tab bottom nav: Chat (event feed) | Dashboard | Recurring | Settings. Insights are shown inline on the Dashboard tab.

4. **Offline behavior:** SMS detection (FB-01) won't work offline. Monthly insights (FB-06) need connectivity for AI generation. Most other features are offline-capable.

5. **Privacy:** SMS reading is extremely sensitive. "All SMS processing happens on-device. No SMS data is ever sent to any server." Communicated in the onboarding flow and privacy docs.
