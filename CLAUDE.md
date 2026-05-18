# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server on localhost:5173 |
| `npm run build` | Type-check (`tsc -b`) then production build (`vite build`) |
| `npm run lint` | ESLint across the whole project |
| `npm test` | Run vitest suite once |
| `npm run test:watch` | Run vitest in watch mode |
| `npm run test:coverage` | Vitest with coverage report |
| `npx tsc --noEmit` | Type-check only, no emit |

Tests are in `src/` colocated with source files (`*.test.ts`, `*.test.tsx`). Vitest uses jsdom environment with `globals: true`.

## Architecture

This is a **fully client-side expense tracker** — no backend, no proxy. The AI agent runs in the browser as an agentic loop: user message → AI provider → tool calls → SQLite writes.

```
User message → Agent loop (agent.ts) → AI provider → Tool executor → DB
                                   ↑ (multi-turn)           ↓
                             Tool results ←──────── Tool calls
```

### Core layers (`src/core/`)

**`agent/`** — The application's intelligence. `agent.ts:processMessage()` is the single entry point (~50 lines). It:
1. Injects merchant hints (cross-session memory) into the system prompt
2. Appends the last 20 messages as conversation history
3. Calls the AI provider; loops on tool calls until the AI responds with text only
4. Persists messages to the `messages` table

**`agent/system-prompt.ts`** — Product behavior lives here, not in code. Changing how the app responds means editing this prompt string. Merchant hints are injected at the bottom as `Known merchants: swiggy→Food, uber→Transport, ...`

**`agent/tool-executor.ts`** — Pure dispatch. Maps tool name → DB function. Money conversion (`rupeesToPaise` / `paiseToRupees`) happens exactly twice — at the executor boundary. Nowhere else.

**`agent/tools.ts`** — 10 AI tool definitions (JSON Schema format sent to providers).

**`agent/tool-schemas.ts`** — Zod schemas for validating tool call arguments before execution.

### Database (`src/core/db/`)

SQLite via SQLocal (OPFS in the browser) + Drizzle ORM. Four tables: `transactions`, `categories`, `messages`, `merchant_hints`. A fifth table `sync_metadata` is a Phase 2 stub (unused in MVP).

- `client.ts` — barrel re-export of all DB operations
- `init.ts` — Drizzle instance, `CREATE TABLE IF NOT EXISTS` DDL, seeds 14 default categories
- `transactions-write.ts` — insert, update, soft-delete (sets `isDeleted=true`), undo-delete. Automatically upserts merchant hints on insert/update.
- `transactions-read.ts` — filtered queries + `getRecent`
- `summaries.ts` — monthly summary aggregation, category breakdown, budget status (spent vs limit per category)
- `merchant-hints.ts` — learns `merchant→category` mappings. When a transaction is saved with a merchant name, it upserts a hint. These hints feed into the system prompt so the AI remembers categories across sessions.

### Money (`src/core/domain/money.ts`)

All monetary values are stored as **paise** (integers, branded type `Paise`). Conversion functions:
- `rupeesToPaise(rupees)` — multiply by 100, round
- `paiseToRupees(paise)` — divide by 100
- `formatINR(paise)` — Indian number formatting, no decimals
- `formatINRCompact(paise)` — ₹5K, ₹1.5L

### Providers (`src/core/providers/`)

Three backends implementing the `AIProvider` interface: Anthropic (Claude Sonnet 4), Gemini (2.0 Flash), DeepSeek (deepseek-chat). The factory (`factory.ts`) creates the right one from settings.

The `AIProvider` interface has `chat()` and `isConfigured()`. The agent loop calls `chat()` for the first turn and `chatWithToolResults()` for subsequent tool-use turns — currently only DeepSeek implements `chatWithToolResults` as a separate method; the others reconstruct the full conversation in `chat()` via their native SDK tool-use patterns.

API keys live in `localStorage`. Calls go direct from the browser to the provider — no proxy.

### Scheduler (`src/core/scheduler.ts`)

Runs every 30 minutes (plus on `visibilitychange`). Detect repeated spending patterns: same category + similar amount (±20%) appearing 3+ times. Emits `Suggestion` objects consumed by the `SuggestionStrip` UI component. Runs locally — no AI credits consumed.

### Logger (`src/core/logger.ts`)

Structured JSON logger — every line has `level`, `message`, `trace_id`. `logger.withTrace()` wraps async operations with `:start`/`:end` lines and `duration_ms`.

### Features (`src/features/`)

- **chat/** — ChatView, MessageBubble, SmartHeader, SuggestionStrip, EmptyState, DateSeparator, plus Zustand store (`chat.store.ts`). The store holds ephemeral UI state (input, sending flag) and delegates persistence to the DB + agent.
- **dashboard/** — Monthly summary and Recharts charts.
- **settings/** — Provider picker + API key management. Settings persisted to localStorage via a Zustand store.

### Routing

Hash-based routing (`window.location.hash`) for PWA compatibility. No TanStack Router usage despite the dependency — three hardcoded tabs: chat, dashboard, settings.

## Key Design Decisions

- **Money in paise as branded type**: `Paise = number & { __brand: 'paise' }`. Prevents accidental mixing with rupees. Conversion only at the tool executor boundary.
- **Soft deletes only**: Transactions are never hard-deleted. `isDeleted` flag, `undo_delete` tool.
- **Cross-session memory via merchant_hints**: The DB remembers `merchant→category` mappings. Injected into the system prompt so the AI picks the right category without asking.
- **System prompt IS product behavior**: Confirmation messages, logging rules, query rules, pattern awareness — all in the prompt string, not in React code.
- **No server, no proxy**: AI calls go direct from the browser. Vite dev server sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers for OPFS/SharedArrayBuffer support.
- **Zustand for ephemeral UI state only**: Persistent data stays in SQLite. Zustand stores hold input buffer, sending flag, settings.

## CI

GitHub Actions on push/PR to `main`: `npm ci` → lint → type-check → test → build → `npm audit --audit-level=high`. Node 22, ubuntu-24.04.
