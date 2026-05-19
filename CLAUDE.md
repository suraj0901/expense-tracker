# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server on localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) then production build (`vite build`) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | ESLint across the whole project |
| `npm test` | Run vitest suite once |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage report |
| `npx tsc --noEmit` | Type-check only, no emit |

Tests are in `src/` colocated with source files (`*.test.ts`). Vitest uses jsdom environment with `globals: true`.

## Architecture

This is a **fully client-side expense tracker** — no backend, no proxy. The AI agent runs in the browser as an agentic loop: user message → AI provider → tool calls → SQLite writes.

```
User message → Agent loop (agent.ts) → AI provider → Tool executor → DB
                                   ↑ (multi-turn)           ↓
                             Tool results ←──────── Tool calls
```

### Core layers (`src/core/`)

**`agent/`** — The application's intelligence. `agent.ts:processMessage()` is the single entry point. It:
1. Injects merchant hints (cross-session memory) into the system prompt
2. Appends the last 20 messages as conversation history
3. Calls the AI provider; loops on tool calls until the AI responds with text only
4. Persists messages to the `messages` table

**`agent/system-prompt.ts`** — Product behavior lives here, not in code. Changing how the app responds means editing this prompt string. Merchant hints are injected at the bottom as `Known merchants: swiggy→Food, uber→Transport, ...`

**`agent/tool-executor.ts`** — Pure dispatch. Maps tool name → DB function. Money conversion (`rupeesToPaise` / `paiseToRupees`) happens at the executor boundary.

**`agent/tools.ts`** — 15 AI tool definitions (JSON Schema format sent to providers): store_expense, store_income, get_expenses, get_monthly_summary, get_category_breakdown, get_recent_transactions, update_expense, delete_expense, get_budget_status, undo_delete, set_goal, get_goals, delete_goal, create_category, list_categories.

**`agent/tool-schemas.ts`** — Zod schemas for validating tool call arguments before execution.

### Database (`src/core/db/`)

SQLite via SQLocal (OPFS in the browser) + Drizzle ORM. Six tables: `transactions`, `categories`, `messages`, `merchant_hints`, `goals`, `insights`. One stub table `sync_metadata` (unused).

- `client.ts` — barrel re-export of all DB operations
- `init.ts` — Drizzle instance, `CREATE TABLE IF NOT EXISTS` DDL, seeds 14 default categories
- `transactions-write.ts` — insert, update, soft-delete (sets `isDeleted=true`), undo-delete. Automatically upserts merchant hints on insert/update.
- `transactions-read.ts` — filtered queries + `getRecent`
- `summaries.ts` — monthly summary aggregation, category breakdown, budget status (spent vs limit per category)
- `merchant-hints.ts` — learns `merchant→category` mappings. When a transaction is saved with a merchant name, it upserts a hint. These hints feed into the system prompt so the AI remembers categories across sessions.
- `goals.ts` — monthly savings/budget goal CRUD
- `insights.ts` — AI-generated monthly insight persistence (cached with staleness detection)
- `categories.ts` — category CRUD operations
- `messages.ts` — message persistence (conversation history)
- `export.ts` — CSV and PDF export utilities

### Money (`src/core/domain/money.ts`)

All monetary values are stored as **paise** (integers, branded type `Paise`). Conversion functions:
- `rupeesToPaise(rupees)` — multiply by 100, round
- `paiseToRupees(paise)` — divide by 100
- `formatINR(paise)` — Indian number formatting, no decimals
- `formatINRCompact(paise)` — ₹5K, ₹1.5L

### Providers (`src/core/providers/`)

Four backends implementing the `AIProvider` interface: Anthropic (Claude Sonnet 4), Gemini (2.0 Flash), DeepSeek (deepseek-chat), and Local (WebLLM via `@mlc-ai/web-llm`, runs Qwen 3.5 2B in-browser). The factory (`factory.ts`) creates the right one from settings.

The `AIProvider` interface has exactly two methods: `chat()` and `isConfigured()`. The agent loop calls `chat()` for every turn, passing the full accumulated message history. No separate tool-result method exists.

API keys live in `localStorage`. Calls go direct from the browser to the provider — no proxy.

### Scheduler (`src/core/scheduler.ts`)

Starts 2 minutes after load, then runs every 30 minutes (plus on `visibilitychange`). Two responsibilities:
1. **Auto-log rules** — runs `processAutoLogRules()` to auto-create transactions for opted-in recurring patterns (same merchant + category + similar amount).
2. **Suggestions** — detects repeated spending patterns (same category + similar amount ±20% appearing 3+ times). Emits `Suggestion` objects consumed by the `SuggestionStrip` UI component. Runs locally — no AI credits consumed.

### Recurring rules (`src/core/recurring.ts`)

Auto-log rule management (localStorage-based). Detects repeated transactions from the same merchant and offers to auto-log them in the future. Tracks frequency, amount patterns, and opt-in status.

### Share target (`src/core/share-target.ts`)

Parses SMS/bank notification text shared from other apps (Android share target). Extracts merchant, amount, and transaction type from bank alert strings.

### Logger (`src/core/logger.ts`)

Structured JSON logger — every line has `level`, `message`, `trace_id`. `logger.withTrace()` wraps async operations with `:start`/`:end` lines and `duration_ms`. Error logs include `error_message` and `error_stack`.

### Features (`src/features/`)

- **chat/** — ChatView, MessageBubble, SmartHeader, SuggestionStrip, EmptyState, DateSeparator, VoiceInput, CategoryPicker, plus Zustand store (`chat.store.ts`). The store holds ephemeral UI state (input, sending flag) and delegates persistence to the DB + agent.
- **dashboard/** — Monthly summary, Recharts charts, and AI-powered monthly insights.
- **settings/** — Provider picker, API key management, auto-log rules management, WebLLM model download card. Settings persisted to localStorage via a Zustand store.
- **drafts/** — SMS/bank share drafts queue. When transactions are shared from other apps, they land here as drafts awaiting one-tap confirmation. Managed via `drafts.store.ts`.

### PWA / Service Worker (`src/sw.ts`)

Full PWA with `vite-plugin-pwa` (injectManifest strategy). Supports:
- **Install prompt** — custom install flow in `App.tsx`
- **Share target** — Android share-to-app for SMS/bank alerts
- **Periodic background sync** — registered in `App.tsx` for offline-ready data refresh
- **Cross-origin isolation** — Vite dev server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` for OPFS/SharedArrayBuffer support

### Routing

Hash-based routing (`window.location.hash`) for PWA compatibility. No TanStack Router usage despite the dependency — three hardcoded tabs: chat, dashboard, settings.

## Key Design Decisions

- **Money in paise as branded type**: `Paise = number & { __brand: 'paise' }`. Prevents accidental mixing with rupees. Conversion at the tool executor boundary.
- **Soft deletes only**: Transactions are never hard-deleted. `isDeleted` flag, `undo_delete` tool.
- **Cross-session memory via merchant_hints**: The DB remembers `merchant→category` mappings. Injected into the system prompt so the AI picks the right category without asking.
- **System prompt IS product behavior**: Confirmation messages, logging rules, query rules, pattern awareness — all in the prompt string, not in React code.
- **No server, no proxy**: AI calls go direct from the browser.
- **Zustand for ephemeral UI state only**: Persistent data stays in SQLite. Zustand stores hold input buffer, sending flag, settings, and draft queue.
- **Tailwind CSS v4**: Styling via `@tailwindcss/vite` Vite plugin. No CSS-in-JS.
- **ID generation via nanoid**: All IDs (transactions, messages, goals, etc.) use `nanoid`.

## CI

GitHub Actions on push/PR to `main`: `npm ci` → lint → type-check → test → build → `npm audit --audit-level=high`. Node 22, ubuntu-24.04.
