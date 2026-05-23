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
- **Hash-based routing** — three tabs: Chat, Dashboard, Settings.
- **Dark theme** — `#0a0a0f` background with Inter font.
