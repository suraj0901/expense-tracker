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
Messages flow through a pluggable pipeline: `[validate] → [connectivity check] → [rate limit] → [sanitize] → [AI call] → [persist]`. Each step is a middleware implementing `MessageMiddleware`. Adding a new check (e.g., internet connectivity) means writing one middleware class and registering it — zero existing code modified.

**Observer / Event Bus (for cross-cutting side effects)**
Modules emit events; subscribers react. `eventBus.emit('transaction:created', tx)`. The merchant-hint learner, scheduler, notifications, and backup each subscribe independently. **Never** call a side-effect function directly from a write operation (e.g., `insertTransaction` must NOT call `upsertMerchantHint`).

**Adapter (for platform APIs)**
Browser APIs are wrapped behind interfaces: `ConnectivityProvider`, `NotificationService`, `StorageAdapter`, `HttpClient`. The domain layer never touches `navigator`, `localStorage`, `fetch`, or `Notification` directly.

### Directory Structure

```
src/
  core/
    domain/           — Layer 2: types, money.ts, pure business functions
    app/              — Layer 3: agent loop, message pipeline, tool registry, scheduler
    infrastructure/   — Layer 1: storage adapters, HTTP, notifications, connectivity
    platform/         — Layer 0: browser API wrappers (OPFS, fetch, navigator)
    providers/        — Layer 1: AI provider implementations (Anthropic, Gemini, etc.)
  features/           — Layer 4+5: React components + Zustand stores (one folder per feature)
    chat/
    dashboard/
    settings/
    drafts/
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

### How to Add New Capabilities

**New tool:** Create `core/app/tools/store-expense.tool.ts` with schema + handler. Register in tool registry. Done. Do NOT edit `tool-executor.ts`.

**New AI provider:** Create `core/providers/new-provider.ts` implementing `AIProvider`. Register in provider registry. Done. Do NOT edit a switch statement.

**New middleware (connectivity check, rate limiter, etc.):** Create middleware class implementing `MessageMiddleware`. Register in pipeline. Done.

**New storage backend (backend API instead of SQLite):** Create `core/infrastructure/api-transaction-repository.ts` implementing `TransactionRepository`. Swap in composition root. Done.

**New platform capability (notifications, background sync):** Create interface in `core/app/interfaces/`. Create platform wrapper in `core/platform/`. Wire in composition root.

### Composition Root

`src/core/composition-root.ts` is the single file that wires providers to consumers. Every interface-to-implementation binding happens here. Nothing else in the codebase calls `new` on a concrete implementation — only the composition root wires concrete classes.

### Testing Rules

- Domain layer: pure unit tests, no mocks needed
- App layer: mock interfaces (repositories, providers), test pipeline logic
- Infrastructure: integration tests against real platform APIs
- UI: test components with mock stores + mock app layer

Every new module ships with its interface + tests for the interface contract. Implementations are tested against the interface contract.

## Key Design Decisions

- **Money in paise as branded type**: `Paise = number & { __brand: 'paise' }`. Prevents accidental mixing with rupees. Conversion at the infrastructure boundary.
- **Soft deletes only**: Transactions are never hard-deleted. `isDeleted` flag, `undo_delete` tool.
- **Cross-session memory via merchant_hints**: The DB remembers `merchant→category` mappings. Injected into the system prompt so the AI picks the right category without asking.
- **System prompt IS product behavior**: Confirmation messages, logging rules, query rules, pattern awareness — all in the prompt string, not in React code.
- **No server, no proxy**: AI calls go direct from the browser.
- **Zustand for ephemeral UI state only**: Persistent data stays in SQLite. Zustand stores hold input buffer, sending flag, settings, and draft queue.
- **Tailwind CSS v4**: Styling via `@tailwindcss/vite` Vite plugin. No CSS-in-JS.
- **ID generation via nanoid**: All IDs (transactions, messages, goals, etc.) use `nanoid`.

## Current State (legacy — being refactored to the above model)

The codebase is currently MVP-quality and does NOT conform to the layer model above. Files that need refactoring:
- `agent.ts` — monolithic, mixed responsibilities, coupled directly to DB. Target: split into pipeline steps.
- `tool-executor.ts` — giant switch statement. Target: registry pattern.
- `init.ts` — duplicate DDL (also in schema.ts). Target: single source of truth.
- `transactions-write.ts` — directly calls merchant hint upsert. Target: event bus.
- `scheduler.ts` — global mutable state. Target: class with injected dependencies.
- `chat.store.ts` — directly calls agent + DB. Target: consume app-layer services via interfaces.
- Various files import `* as db from '../db/client'` — Target: import repository interfaces.

When modifying these files, refactor toward the target pattern incrementally. One logical change per commit.

## CI

GitHub Actions on push/PR to `main`: `npm ci` → lint → type-check → test → build → `npm audit --audit-level=high`. Node 22, ubuntu-24.04.
