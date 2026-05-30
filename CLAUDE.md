# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start Vite dev server on localhost:5173 |
| `pnpm build` | Type-check (`tsc -b`) then production build (`vite build`) |
| `pnpm preview` | Preview production build locally |
| `pnpm lint` | ESLint across the whole project |
| `pnpm test` | Run vitest suite once |
| `pnpm test:watch` | Run vitest in watch mode |
| `pnpm test:coverage` | Vitest with coverage report |
| `npx tsc --noEmit` | Type-check only, no emit |
| `node server.js` | Production server with COOP/COEP headers (required for OPFS) |

Use **pnpm** — not npm or yarn. The project is a pnpm workspace (`pnpm-lock.yaml`, `pnpm-workspace.yaml`).

Tests are in `src/` colocated with source files (`*.test.ts`). Vitest uses jsdom environment with `globals: true`.

## Architecture

This is a **fully client-side expense tracker** — no backend, no proxy. The AI agent runs in the browser as an agentic loop.

Every module follows **provider-consumer pattern**: a consumer declares an interface of what it needs; a provider implements it. The wiring happens in one place. This is mandatory — never skip the interface and couple directly to a concrete implementation.

### Layer Model (strict top-down)

Dependencies point **inward and downward only**. A lower layer MUST NOT import from a higher layer.

```
Layer 5: UI / Presentation       — React components, Tailwind
    ↓ may import from
Layer 4: Framework Integration   — Zustand stores, React hooks
    ↓ may import from
Layer 3: Application / Agent     — Message pipeline, tool loop, scheduler
    ↓ may import from
Layer 2: Domain / Business Logic — Money, transactions, budgets, goals, rules
    ↓ may import from
Layer 1: Infrastructure          — Storage adapters, HTTP clients, notifications
    ↓ may import from
Layer 0: Platform                — Browser APIs (fetch, OPFS, navigator, Service Worker)
```

### Mandatory Patterns

**Provider-Consumer (always)**
Every capability is a consumer-interface + provider-implementation pair. The agent consumes a `MessageRepository` interface; the DB layer provides `SQLiteMessageRepository`. The UI consumes a `ConnectivityProvider` interface; the platform layer provides `BrowserConnectivity`. **Never** import a concrete implementation directly from a higher layer — always depend on the interface.

**Registry (for dispatch with open extension points)**
Tools, providers, and pipeline steps use a registry pattern. Each tool registers itself: `toolRegistry.register('store_expense', { schema, handler })`. The executor loops over `toolRegistry.entries()`. **Never** write a switch statement for dispatch — it violates Open/Closed. When adding a new tool, create a file and register it; do NOT edit the executor.

**Message Pipeline (for agent message processing)**
Messages flow through a pluggable middleware pipeline. The pipeline is defined in `core/agent/middleware.ts` with 9 middleware stages: `loadMerchantHints → buildMessages → persistUserMessage → spendingGuardAugment → callAIProvider → enforceSpendingGuard → persistResponse → createEvents → checkMerchantConfidence → proactiveSuggestions`. `agent.ts` is now a thin wrapper that composes these stages. Adding a new check means writing one middleware class and inserting it into the pipeline — zero existing code modified.

**Observer / Event Bus (for cross-cutting side effects)**
Modules emit events; subscribers react. `eventBus.emit('transaction:created', tx)`. The merchant-hint learner, scheduler, notifications, and backup each subscribe independently. **Never** call a side-effect function directly from a write operation (e.g., `insertTransaction` must NOT call `upsertMerchantHint`).

**Adapter (for platform APIs)**
Browser APIs are wrapped behind interfaces: `ConnectivityProvider`, `NotificationService`, `StorageAdapter`, `HttpClient`. The domain layer never touches `navigator`, `localStorage`, `fetch`, or `Notification` directly.

### Directory Structure

```
src/
  core/
    domain/           — Layer 2: types.ts, money.ts (Paise branded type, converters)
    app/              — Layer 3: interfaces.ts, event-bus.ts, tool-registry.ts, provider-registry.ts, event-generators.ts
      tools/          — 29 self-registering tool files (one per tool: store-expense, get-expenses, etc.)
    agent/            — Layer 3: agent.ts (thin pipeline wrapper), middleware.ts (9 pipeline stages), system-prompt.ts, tool-executor.ts, tools.ts, tool-schemas.ts, proactive-agent.ts
    infrastructure/   — Layer 1: SQLite repository implementations (one per aggregate)
    platform/         — Layer 0: kv-store.ts (OPFS), sms-detector.ts
    providers/        — Layer 1: AI provider implementations (Anthropic, Gemini, DeepSeek, WebLLM)
    db/               — SQLite via Drizzle ORM: schema.ts, init.ts, CRUD modules
    composition-root.ts — Single wiring file: all interface→impl bindings, registrations, event bus subscribers
    logger.ts         — Structured JSON logging (traceId, RED metrics)
    scheduler.ts      — Periodic pattern detection + notifications
    share-target.ts   — Web Share Target API parser (SMS/bank alerts → draft transactions)
    suggestions.ts    — Personalized suggestion chip algorithm
    recurring.ts      — Auto-log rule persistence
    insight-report.ts — Monthly AI insight generation
  features/           — Layer 4+5: React components + Zustand stores
    chat/             — ChatView, MessageBubble, TransactionCard, EventFeed, VoiceInput, etc.
    dashboard/        — DashboardView, CategoryTransactionsView, insights
    settings/         — SettingsView, AutoLogRules, ModelDownloadCard
    drafts/           — DraftBanner, draft queue from SMS share target
    onboarding/       — OnboardingScreen (permissions: notifications, storage, SMS)
    recurring/        — RecurringView (auto-log rules table)
  sw.ts               — Service Worker (Workbox + periodic background sync)
```

### Import Rules (enforced — do NOT violate)

| Layer | May import from |
|-------|----------------|
| `features/` (UI + stores) | `core/app/`, `core/domain/`, `core/infrastructure/` interfaces |
| `core/app/` | `core/domain/`, `core/infrastructure/` interfaces |
| `core/domain/` | nothing (pure TypeScript, zero dependencies) |
| `core/infrastructure/` | `core/domain/`, `core/platform/` |
| `core/platform/` | nothing (browser APIs only) |

**Forbidden imports (will be rejected in review):**
- `features/` importing from `core/infrastructure/` concrete implementations (only interfaces)
- `features/` importing from `core/db/` (use repository interfaces via app layer)
- `core/domain/` importing anything outside `core/domain/`
- `core/app/` importing from `features/` (UI must depend on app, not vice versa)
- Any file importing `* as db from '../db/client'` directly — use the repository interface

### Path Alias

`@` maps to `src/` (configured in `vite.config.ts`). Import as `@/core/composition-root`.

### How to Add New Capabilities

**New tool:** Create `core/app/tools/my-tool.tool.ts` with schema + handler. Add Zod schema to `tool-schemas.ts`, definition to `tools.ts`, register in `composition-root.ts`. Do NOT edit `tool-executor.ts`.

**New AI provider:** Create `core/providers/new-provider.ts` implementing `AIProvider`. Register in provider registry. Done.

**New middleware:** Create a middleware object implementing `Middleware` interface. Insert into the pipeline in `agent.ts`.

**New storage backend:** Create `core/infrastructure/api-transaction-repository.ts` implementing `TransactionRepository`. Swap in composition root.

**New platform capability:** Create interface in `core/app/interfaces/`. Create platform wrapper in `core/platform/`. Wire in composition root.

### Composition Root

`src/core/composition-root.ts` is the single file that wires providers to consumers. Every interface-to-implementation binding, tool registration, provider registration, and event bus subscription happens here. Nothing else in the codebase calls `new` on a concrete implementation — only the composition root wires concrete classes.

### Testing Rules

- Domain layer: pure unit tests, no mocks needed
- App layer: mock interfaces (repositories, providers), test pipeline logic
- Infrastructure: integration tests against real platform APIs
- UI: test components with mock stores + mock app layer

## Key Design Decisions

- **Money in paise as branded type**: `Paise = number & { __brand: 'paise' }`. Prevents accidental mixing with rupees. Conversion at the infrastructure boundary.
- **Soft deletes only**: Transactions are never hard-deleted. `isDeleted` flag, `undo_delete` tool.
- **Cross-session memory via merchant_hints**: The DB remembers `merchant→category` mappings. Injected into the system prompt so the AI picks the right category without asking.
- **System prompt IS product behavior**: Confirmation messages, logging rules, query rules, pattern awareness — all in the prompt string, not in React code.
- **No server, no proxy**: AI calls go direct from the browser. API keys in OPFS-backed KV store.
- **Zustand for ephemeral UI state only**: Persistent data stays in SQLite. Zustand stores hold input buffer, sending flag, settings, and draft queue.
- **Tailwind CSS v4**: Styling via `@tailwindcss/vite` Vite plugin. No CSS-in-JS.
- **ID generation via nanoid**: All IDs (transactions, messages, goals, etc.) use `nanoid`.
- **Hash-based routing**: TanStack Router with `/#/chat`, `/#/dashboard`, `/#/recurring`, `/#/settings`. Hash-based because there's no server to handle fallback routes.
- **COOP/COEP headers required**: SQLite WASM + OPFS needs `SharedArrayBuffer`, which requires cross-origin isolation headers. Vite dev server sets them; `server.js` sets them in production; `netlify.toml` and `vercel.json` set them on those platforms.
- **PWA with Share Target**: The app registers as a PWA (manifest + service worker). Android's Web Share Target allows sharing SMS/bank alerts directly into the app for auto-parsing into draft transactions.

## Current Refactoring Status

The codebase has been substantially refactored toward the target architecture:

**Done:**
- Composition root — clean wiring, all registrations in one place
- Tool registry with 29 self-registering tools
- Middleware pipeline (9 stages in `middleware.ts`); `agent.ts` is a thin wrapper
- Event bus with typed events and subscribers
- Provider registry pattern
- Repository interfaces + SQLite implementations with event-enriched wrappers
- Domain types and money utilities

**Still in progress:**
- `init.ts` — some DDL duplication with `schema.ts`. Target: single source of truth.
- `transactions-write.ts` — some paths still call merchant hint upsert directly. Target: event bus for all side effects.
- `scheduler.ts` — global mutable state. Target: class with injected dependencies.
- `chat.store.ts` — directly calls agent + composition-root. Target: consume app-layer services via interfaces.
- Some files still import from `core/db/client` directly — Target: import repository interfaces from composition-root.

When modifying these files, refactor toward the target pattern incrementally. One logical change per commit.

## CI

GitHub Actions on push/PR to `main`: `pnpm install --frozen-lockfile` → lint → type-check → test → build → `pnpm audit --audit-level=high`. Node 22, ubuntu-24.04.
