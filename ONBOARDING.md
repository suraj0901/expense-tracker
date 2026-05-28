# ONBOARDING.md

Hey there. Welcome to the AI Expense Tracker. This doc is your pair-programmer crash course — everything you need to understand the codebase and be productive on day one.

---

## 1. What is this thing?

An expense tracker, but instead of forms and dropdowns, you just **chat with it**. "Spent ₹120 on Swiggy" → done. The AI agent figures out categories, amounts, dates, runs queries, generates reports — all through tool calls. Everything runs **in your browser**. No backend, no proxy, no server. Data lives in SQLite via OPFS (Origin Private File System). AI calls go direct from your browser to Anthropic/Google/DeepSeek. It's also a PWA — installable, works offline-ish, and supports SMS-based auto-logging on Android.

---

## 2. Quick Start

```bash
git clone <repo-url>
cd expense-tracker
pnpm install
pnpm dev          # → http://localhost:5173
```

You need **pnpm** — not npm, not yarn. The project uses a pnpm workspace.

**You need an API key to do anything.** Open Settings, paste your Anthropic or Gemini key, and you're off. For zero-cost testing, use the **Local (WebLLM)** provider — it downloads a ~1 GB model and runs entirely on-device via WebGPU, no API key needed.

### The dev server is special

Open `vite.config.ts` — you'll see COOP/COEP headers:

```ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

These are **required** for SQLite WASM + OPFS (needs `SharedArrayBuffer`). If you remove them, the database won't initialize and the app falls back to in-memory mode where all data is lost on refresh.

### Useful commands

| Command | What |
|---------|------|
| `pnpm dev` | Vite dev server on localhost:5173 |
| `pnpm build` | `tsc -b` then `vite build` |
| `pnpm lint` | ESLint across the project |
| `pnpm test` | Vitest once |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm test:coverage` | Vitest with coverage report |
| `pnpm preview` | Preview production build locally |
| `npx tsc --noEmit` | Type-check only, no emit |

---

## 3. Architecture: The Layer Model

This is the most important concept. Dependencies **only flow inward and downward**. A lower layer must never import from a higher layer.

```
Layer 5: UI / Presentation        — React components, Tailwind
    ↓ may import from
Layer 4: Framework Integration    — Zustand stores, React hooks
    ↓ may import from
Layer 3: Application / Agent      — Message pipeline, tool loop, scheduler
    ↓ may import from
Layer 2: Domain / Business Logic  — Money (Paise), transactions, budgets, goals
    ↓ may import from
Layer 1: Infrastructure           — Storage adapters, HTTP, notifications
    ↓ may import from
Layer 0: Platform                 — Browser APIs (fetch, OPFS, navigator, SW)
```

### Import rules — enforced, do NOT violate

| Layer | May import from |
|-------|----------------|
| `features/` (UI + stores) | `core/app/`, `core/domain/`, `core/infrastructure/` **interfaces only** |
| `core/app/` | `core/domain/`, `core/infrastructure/` interfaces |
| `core/domain/` | nothing — pure TypeScript, zero dependencies |
| `core/infrastructure/` | `core/domain/`, `core/platform/` |
| `core/platform/` | nothing — browser APIs only |

### Forbidden imports (these will get rejected in review)

- `features/` importing from `core/db/` — use repository interfaces instead
- `features/` importing concrete infrastructure implementations — depend on interfaces
- `core/domain/` importing anything outside `core/domain/`
- `core/app/` importing from `features/` — UI must depend on app, never the reverse
- Any file doing `import * as db from '../db/client'` directly — use the repository interface

---

## 4. Codebase Tour

Here's what lives where, directory by directory.

```
src/
├── main.tsx                    # React entry point
├── App.tsx                     # Root component, hash router, DB init, scheduler, SW messages
├── index.css                   # Tailwind imports + global custom properties
├── sw.ts                       # Service Worker (Workbox + periodic background sync)
│
├── core/
│   ├── composition-root.ts     # ⭐ THE WIRING FILE — every interface→impl binding lives here
│   ├── logger.ts               # Structured JSON logger (traceId, RED metrics per operation)
│   ├── share-target.ts         # Parses shared text from Web Share Target API (SMS/bank alerts)
│   ├── recurring.ts            # Auto-log rule persistence (KV-backed, learned from accepted suggestions)
│   ├── scheduler.ts            # Runs every 30 min + tab visibility change — pattern detection + notifications
│   ├── suggestions.ts          # Personalized suggestion chip algorithm (time-of-day × recency × frequency)
│   ├── insight-report.ts       # Monthly AI insight generation and persistence
│   │
│   ├── domain/                 # Layer 2 — pure TypeScript, zero deps
│   │   ├── types.ts            # All domain types: Transaction, Message, Goal, AppEvent, Category, Chip, etc.
│   │   └── money.ts            # Paise branded type + converters: rupeesToPaise, paiseToRupees, formatINR, formatINRCompact
│   │
│   ├── app/                    # Layer 3 — agent, tools, registries, event bus
│   │   ├── interfaces.ts       # Repository interfaces: TransactionRepository, MessageRepository, CategoryRepository, etc.
│   │   ├── event-bus.ts        # Typed EventBus<T> — emit/subscribe pattern for cross-cutting side effects
│   │   ├── tool-registry.ts    # ToolRegistry class — tools self-register, executor dispatches by name
│   │   ├── provider-registry.ts# ProviderRegistry — factory-based, maps provider ID to constructor
│   │   └── tools/              # 15 tool files, one per tool (each exports an object matching ToolHandler)
│   │
│   ├── agent/                  # AI agent coordination
│   │   ├── agent.ts            # processMessage() — the agent loop: hints → prompt → AI call → tool loop → guard → persist
│   │   ├── system-prompt.ts    # System prompt string — product behavior lives in this prompt
│   │   ├── tool-executor.ts    # Delegates to ToolRegistry.execute() (not a switch statement)
│   │   ├── tools.ts            # TOOL_DEFINITIONS[] — JSON Schema format for AI providers
│   │   └── tool-schemas.ts     # Zod schemas for each tool (runtime validation)
│   │
│   ├── db/                     # SQLite via Drizzle ORM + SQLocal
│   │   ├── schema.ts           # Drizzle table definitions (7 tables): categories, transactions, transaction_tags, messages, merchant_hints, goals, events
│   │   ├── init.ts             # DB bootstrap, DDL creation, seed default categories
│   │   ├── client.ts           # Barrel — initializeDatabase(), getStorageInfo(), sqlite instance
│   │   ├── transactions-write.ts # Insert, update, soft-delete, undo-delete
│   │   ├── transactions-read.ts  # Query, getRecent, getById
│   │   ├── categories.ts       # Category CRUD
│   │   ├── goals.ts            # Goal CRUD
│   │   ├── messages.ts         # Message save/getHistory/getAll
│   │   ├── merchant-hints.ts   # Merchant hint upsert/getTop
│   │   ├── summaries.ts        # getMonthlySummary, getCategoryBreakdown, getBudgetStatus
│   │   ├── insights.ts         # Insight crud, isStale check
│   │   ├── events.ts           # Event insert/getRecent/getAll, updateStatus, dismissAll
│   │   ├── transaction-tags.ts # Tag management
│   │   ├── export.ts           # CSV (BOM) + PDF (jsPDF) export
│   │   └── backup.ts           # OPFS backup/restore, localStorage auto-backup, CSV/PDF export
│   │
│   ├── infrastructure/         # Layer 1 — implements repository interfaces (bridges domain ↔ db)
│   │   ├── sqlite-transaction-repository.ts
│   │   ├── sqlite-message-repository.ts
│   │   ├── sqlite-category-repository.ts
│   │   ├── sqlite-merchant-hint-repository.ts
│   │   ├── sqlite-goal-repository.ts
│   │   ├── sqlite-summary-repository.ts
│   │   ├── sqlite-insight-repository.ts
│   │   └── sqlite-event-repository.ts
│   │
│   ├── providers/              # Layer 1 — AI provider implementations (implement AIProvider interface)
│   │   ├── types.ts            # AIProvider interface, ProviderSettings, ProviderMessage, ProviderResponse
│   │   ├── factory.ts          # createProvider() factory — constructs the right provider class
│   │   ├── anthropic.ts        # Claude Sonnet 4 (Anthropic SDK, tool use forced on first turn)
│   │   ├── gemini.ts           # Gemini 2.0 Flash (Google SDK, function calling forced for 5 turns)
│   │   ├── deepseek.ts         # DeepSeek (OpenAI-compatible API)
│   │   └── local.ts            # WebLLM — Qwen 3.5 2B running on-device via WebGPU
│   │
│   └── platform/               # Layer 0 — browser API wrappers
│       ├── kv-store.ts         # OPFS-backed key-value store (initKvStore, kvGet, kvSet, kvRemove, with in-memory cache)
│       └── sms-detector.ts     # SMS text pattern parser (shared from Android)
│
└── features/                   # Layer 4+5 — React components + Zustand stores
    ├── chat/
    │   ├── ChatView.tsx         # Main chat interface container
    │   ├── MessageBubble.tsx    # Renders user/assistant messages (with Markdown support)
    │   ├── EventFeed.tsx        # Renders structured event cards instead of raw messages
    │   ├── event-cards/         # Individual event card components (EventCard.tsx, EventFeed.css)
    │   ├── SmartHeader.tsx      # Always-visible bar: today's spend + month total
    │   ├── SuggestionStrip.tsx  # Personalized suggestion chips above the input
    │   ├── VoiceInput.tsx       # Web Speech API (en-IN, single utterance)
    │   ├── EmptyState.tsx       # Example messages + quick-action chips when no history
    │   ├── CategoryPicker.tsx   # Emoji category selector
    │   ├── EditTransactionModal.tsx # Inline transaction editing
    │   ├── OfflineBanner.tsx    # Shows when offline
    │   ├── RecentTransactions.tsx   # Recent transaction list with Edit/Delete
    │   ├── DateSeparator.tsx    # "Today" / "Yesterday" / weekday / date separators
    │   ├── categoryIcons.tsx    # Category → emoji mapping utility
    │   ├── chat.store.ts        # Zustand — messages, input buffer, sending flag, history
    │   └── messageQueue.store.ts # Zustand — offline message queue, retry logic
    ├── dashboard/
    │   ├── DashboardView.tsx    # Summary cards, donut chart, bar chart, goals, insights
    │   ├── CategoryTransactionsView.tsx # Filtered transaction list per category
    │   └── insights.ts          # AI insight generation logic
    ├── drafts/
    │   ├── DraftBanner.tsx      # Draft transaction banner with "Log it"/"Dismiss"
    │   ├── drafts.store.ts      # Zustand — draft queue from SMS share target
    │   └── types.ts             # Draft transaction type
    ├── onboarding/
    │   ├── OnboardingScreen.tsx # Permissions screen: notifications, storage, SMS
    │   └── onboarding.store.ts  # Persists onboarding completion state
    ├── recurring/
    │   ├── RecurringView.tsx    # Recurring rules table — enable/disable/remove
    │   └── recurring.store.ts   # Zustand — recurring rule state
    └── settings/
        ├── SettingsView.tsx     # Provider selection, API keys, export, backup, storage info
        ├── AutoLogRules.tsx     # Recurring auto-log rules management
        ├── ModelDownloadCard.tsx # WebLLM model download progress UI
        └── settings.store.ts    # Zustand — active provider, API keys, WebLLM state
```

### Three files you should read first

1. **`src/core/composition-root.ts`** — Every interface-to-implementation binding happens here. The event bus wiring, tool registrations, provider registrations, and the enriched transactionRepo that auto-emits events. This is the spinal cord of the app.

2. **`src/core/domain/types.ts`** — All the shapes: `Transaction`, `Message`, `Goal`, `AppEvent`, `Category`, `Chip`, `FeedItem`. Understanding these types means understanding the data model.

3. **`src/core/agent/agent.ts`** — The agent loop. `processMessage()` takes user text + history + AI provider → returns `AgentResponse`. It injects merchant hints, builds the system prompt, calls the AI, executes tools in a loop (up to 8 iterations), enforces a spending-intent guard, and persists everything. ~285 lines that replace what would typically be a dozen microservices.

---

## 5. Core Patterns (with real code from the codebase)

### Pattern 1: Provider-Consumer (always)

Every capability has an **interface** (what the consumer needs) and an **implementation** (how it's fulfilled). Never depend on a concrete class directly. The wiring happens in one place — composition-root.ts.

**Interface** (`src/core/app/interfaces.ts`):
```ts
export interface TransactionRepository {
  insert(params: InsertTransactionParams): Promise<{ success: boolean; id: string }>;
  update(id: string, params: UpdateTransactionParams): Promise<{ success: boolean; id: string }>;
  softDelete(id: string): Promise<{ success: boolean; id: string }>;
  query(params: QueryTransactionsParams): Promise<Transaction[]>;
  getRecent(count?: number): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
}
```

**Implementation** (`src/core/infrastructure/sqlite-transaction-repository.ts`):
```ts
export function createTransactionRepository(): TransactionRepository {
  return {
    async insert(params) { return insertTransaction(params); },
    async update(id, params) { return updateTransaction(id, params); },
    async softDelete(id) { return softDeleteTransaction(id); },
    async query(params) { return queryTransactions(params); },
    async getRecent(count) { return getRecentTransactions(count); },
    async getById(id) { return getTransactionById(id); },
  };
}
```

**Wiring** (`src/core/composition-root.ts`):
```ts
export const transactionRepo = createTransactionRepository();
```

**Consumer** (a tool — only depends on the interface via `ToolDependencies`):
```ts
// store-expense.tool.ts
async execute(args, deps: ToolDependencies) {
  return deps.transactionRepo.insert({
    id: nanoid(),
    amount: rupeesToPaise(args.amount as number),
    type: 'expense',
    category: args.category as string,
    // ...
  });
}
```

This means if we ever swap SQLite for a backend API, only the infrastructure layer changes. Tools, UI, agent — they don't know the difference.

### Pattern 2: Registry (no switch statements, ever)

Tools and providers self-register. Adding one means creating a file + one registration line in composition-root. You **never** edit a dispatcher file.

**Tool Registry** (`src/core/app/tool-registry.ts`):
```ts
export class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  register(handler: ToolHandler): void {
    this.tools.set(handler.name, handler);
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  async execute(call: ToolCall, deps: ToolDependencies): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) return { toolCallId: call.id, result: null, error: `Unknown tool: ${call.name}` };
    const parseResult = tool.schema.safeParse(call.args);
    if (!parseResult.success) {
      return { toolCallId: call.id, result: null, error: `Invalid arguments: ${parseResult.error.message}` };
    }
    const result = await tool.execute(call.args, deps);
    return { toolCallId: call.id, result };
  }
}
```

**Registration** (`src/core/composition-root.ts`):
```ts
toolRegistry.register(storeExpenseTool);
toolRegistry.register(storeIncomeTool);
toolRegistry.register(getExpensesTool);
// ... 15 tools total
```

**Provider Registry** — same pattern, factory-based:
```ts
providerRegistry.register('anthropic', (key) => new AnthropicProvider(key));
providerRegistry.register('gemini', (key) => new GeminiProvider(key));
providerRegistry.register('deepseek', (key) => new DeepSeekProvider(key));
providerRegistry.register('webllm', () => new LocalAIProvider());
```

### Pattern 3: Event Bus (cross-cutting side effects)

Write operations **never** call side effects directly. They emit events. Subscribers react independently. This keeps the write path pure.

**The wrapping** (`src/core/composition-root.ts`):
```ts
const originalInsert = transactionRepo.insert.bind(transactionRepo);
const enriched: TransactionRepository = {
  ...transactionRepo,
  async insert(params: InsertTransactionParams) {
    const result = await originalInsert(params);
    eventBus.emit('transaction:created', {
      merchant: params.merchant ?? null,
      category: params.category,
      amount: params.amount,
      id: params.id,
    });
    return result;
  },
};
```

**Subscribers react independently** — merchant hints and events are updated without the insert function knowing about them:
```ts
eventBus.on('transaction:created', (args) => {
  if (args.merchant) merchantHintRepo.upsert(args.merchant, args.category).catch(() => {});
  eventRepo.insert({
    id: nanoid(),
    type: 'transaction_logged',
    title: 'Transaction logged',
    body: `₹${paiseToRupees(args.amount as Paise)} ${args.category}${args.merchant ? ` at ${args.merchant}` : ''}`,
    data: { transactionId: args.id, category: args.category, amount: args.amount, merchant: args.merchant },
    createdAt: Date.now(),
  }).catch(() => {});
});
```

The `insertTransaction` DB function itself is pure — it inserts a row and that's it. It doesn't know about merchant hints, event feeds, or notifications.

### Pattern 4: Adapter (browser APIs behind interfaces)

The domain layer never touches `navigator`, `fetch`, `localStorage`, or `Notification` directly. Everything is wrapped behind an interface.

**Example** (`src/core/platform/kv-store.ts`): Wraps OPFS file operations behind a simple `kvGet`/`kvSet`/`kvRemove` API with an in-memory cache. The rest of the app calls `kvGet('onboarding:completed')` — it doesn't know or care that it's reading from OPFS.

### Pattern 5: Message Pipeline (pluggable middleware)

The CLAUDE.md describes this as the target pattern for agent message processing. Messages should flow through pluggable middleware steps: `[validate] → [connectivity check] → [rate limit] → [sanitize] → [AI call] → [persist]`. Each step is a middleware implementing `MessageMiddleware`. Currently the agent loop does most of this inline in `processMessage()` — it's being incrementally refactored toward the pipelined model.

---

## 6. Key Design Decisions

### Money in paise (branded type)

```ts
// src/core/domain/money.ts
export type Paise = number & { readonly __brand: 'paise' };

export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100) as Paise;
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}
```

All monetary values in the database are integers in paise. Conversion happens at the boundary — `rupeesToPaise` on the way in (tool handlers), `paiseToRupees` or `formatINR` on the way out (display). The branded type (`__brand: 'paise'`) prevents you from accidentally passing a rupee amount where paise is expected. TypeScript won't compile it. No more `$1.20 * 100 = 120.0000000001` bugs.

### Soft deletes only

Transactions are never hard-deleted. The `isDeleted` column marks them. There's an `undo_delete` tool. The `delete_expense` tool calls `softDelete()`, not `DELETE FROM`. This means no data loss even if the AI or user makes a mistake.

### Cross-session memory via merchant_hints

The `merchant_hints` table remembers `merchant → category` mappings across sessions. When a user says "₹250 at Swiggy", the AI already knows it's "Food" because merchant hints are injected into the system prompt. New or low-confidence merchants generate `merchant_mapping_ask` events in the chat feed for async confirmation.

### System prompt IS product behavior

Look at `src/core/agent/system-prompt.ts`. Confirmation messages, logging rules, category selection rules, budget awareness behavior, query formatting — it's all in the prompt string. Changing how the app *behaves* (not just how it looks) often means editing the prompt, not component code.

### API keys in the browser

Keys are stored in the OPFS-backed KV store, never sent to any backend. AI calls go direct from browser to the provider's API endpoint. The Anthropic SDK has `dangerouslyAllowBrowser: true` for this reason. This is a deliberate privacy decision. The trade-off: API keys live in browser memory and could be extracted by XSS.

### No server, no proxy

Every AI call is a direct `fetch` or SDK call from the browser. There's no middleware server relaying requests. This means the app works deployed to any static host (Netlify, Vercel, GitHub Pages) with zero server costs.

### ID generation via nanoid

All IDs — transactions, messages, goals, events — use `nanoid`. Short, URL-safe, collision-resistant. No auto-increment integers, no UUIDs.

### 4-tab hash-based routing

The app uses TanStack Router with hash-based routing (`/#/chat`, `/#/dashboard`, `/#/recurring`, `/#/settings`). Hash-based because there's no server to handle fallback routes — everything is served from a single `index.html`.

### Zustand for ephemeral UI state only

Persistent data stays in SQLite. Zustand stores hold: chat messages buffer, sending flag, active provider settings, draft queue, onboarding state. If it needs to survive a page refresh, it goes in SQLite or the KV store.

---

## 7. How to Add Features

### Adding a new AI tool

1. Create `src/core/app/tools/my-new-tool.tool.ts`:
   ```ts
   import { nanoid } from 'nanoid';
   import type { ToolHandler, ToolDependencies } from '../tool-registry';
   import { MyNewSchema } from '../../agent/tool-schemas';

   export const myNewTool: ToolHandler = {
     name: 'my_new_tool',
     schema: MyNewSchema,
     definition: {
       name: 'my_new_tool',
       description: 'What this tool does — the AI reads this',
       parameters: {
         type: 'object',
         properties: {
           some_param: { type: 'string', description: 'Description for the AI' },
         },
         required: ['some_param'],
       },
     },
     async execute(args, deps: ToolDependencies) {
       // Use deps.transactionRepo, deps.categoryRepo, deps.goalRepo, deps.summaryRepo
       return { result: 'something meaningful' };
     },
   };
   ```
2. Add the Zod schema to `src/core/agent/tool-schemas.ts`
3. Add the definition to the `TOOL_DEFINITIONS` array in `src/core/agent/tools.ts`
4. Register in `src/core/composition-root.ts`: `toolRegistry.register(myNewTool);`
5. That's it. Do **NOT** edit `tool-executor.ts` — it delegats to the registry.

### Adding a new AI provider

1. Create `src/core/providers/new-provider.ts` implementing the `AIProvider` interface from `types.ts`:
   ```ts
   import type { AIProvider, ProviderMessage, ProviderResponse } from './types';
   import type { ToolDefinition } from '../agent/tools';

   export class NewProvider implements AIProvider {
     readonly name = 'NewAI';
     readonly id = 'newai';
     private apiKey: string;

     constructor(apiKey: string) { this.apiKey = apiKey; }
     isConfigured(): boolean { return !!this.apiKey; }
     async chat(messages: ProviderMessage[], tools: ToolDefinition[]): Promise<ProviderResponse> {
       // implement the API call
     }
   }
   ```
2. Register in `src/core/composition-root.ts`: `providerRegistry.register('newai', (key) => new NewProvider(key));`
3. Add `'newai'` to the `ProviderType` union in `src/core/providers/types.ts`
4. Add UI in `src/features/settings/SettingsView.tsx`
5. Add key management in `src/features/settings/settings.store.ts`

### Adding a new feature tab

1. Create `src/features/my-feature/` with components and a Zustand store
2. Add the route type and navigation in `src/App.tsx`
3. The store should only import from `core/app/` interfaces (e.g., `transactionRepo`, `categoryRepo`), never from `core/db/` directly
4. Add any new SQL queries to the appropriate db module, expose them through the repository interface

### Adding a new database table

1. Define the Drizzle table in `src/core/db/schema.ts`
2. Add DDL creation in `src/core/db/init.ts`
3. Create the raw DB functions in `src/core/db/` (e.g., `my-data.ts`)
4. Create a repository interface in `src/core/app/interfaces.ts`
5. Create the SQLite implementation in `src/core/infrastructure/`
6. Wire in `src/core/composition-root.ts`
7. If other modules need to react to writes, use the event bus (emit events, subscribe in composition-root)

---

## 8. Testing Approach

Tests live **colocated** with source files: `*.test.ts` (or `*.test.tsx`) next to the code they test. Vitest with jsdom environment and `globals: true` is the default — you get `describe`, `it`, `expect` without imports.

### By layer

| Layer | Testing style | Example files |
|-------|-------------|---------------|
| **Domain** (`core/domain/`) | Pure unit tests, zero mocks | `money.test.ts` |
| **App** (`core/app/`, `core/agent/`) | Mock repository interfaces, test logic | `agent.test.ts`, `tools.test.ts` |
| **Infrastructure** | Integration tests against real platform APIs | *(if/when added)* |
| **UI** (`features/`) | Test components with mock stores + mock app layer | `drafts.store.test.ts` |
| **Store** (`features/*/`) | Unit test store logic with mock repository calls | `drafts.store.test.ts` |

### What tests look like

Domain test (pure, deterministic):
```ts
// src/core/domain/money.test.ts
describe('rupeesToPaise → paiseToRupees round-trip', () => {
  it('is identity for whole numbers', () => {
    for (const r of [0, 1, 5, 10, 100, 50000]) {
      expect(paiseToRupees(rupeesToPaise(r))).toBe(r);
    }
  });
});
```

Agent test (pure functions, no mocks):
```ts
// src/core/agent/agent.test.ts
describe('hasSpendingIntent', () => {
  it('detects ₹ symbol with amount', () => {
    expect(hasSpendingIntent('spent ₹120 on food')).toBe(true);
  });
  it('does not flag conversational messages', () => {
    expect(hasSpendingIntent('hello how are you')).toBe(false);
  });
});
```

Store test (mock dependencies, test state transitions):
```ts
// src/features/drafts/drafts.store.test.ts
import { useDraftStore } from './drafts.store';

it('adds a draft and marks it as pending', () => {
  const { add, drafts } = useDraftStore.getState();
  add({ amount: 500, merchant: 'Dmart', date: '2024-12-01' });
  const state = useDraftStore.getState();
  expect(state.drafts).toHaveLength(1);
  expect(state.drafts[0].status).toBe('pending');
});
```

---

## 9. Common Pitfalls

### Calling the DB directly from UI or stores

Wrong:
```ts
// ❌ In a Zustand store or component
import { queryTransactions } from '../../core/db/transactions-read';
const rows = await queryTransactions({ limit: 10 });
```

Right:
```ts
// ✅ Use the repository interface exported from composition-root
import { transactionRepo } from '../../core/composition-root';
const rows = await transactionRepo.getRecent(10);
```

The repository is wired once in composition-root. It auto-emits events (enriched version). Bypassing it means merchant hints won't learn and events won't fire.

### Duplicating DDL

The schema is defined in `db/schema.ts` (Drizzle). The `db/init.ts` file creates tables. These should be in sync. Currently they have some drift (noted in CLAUDE.md) — when you modify the schema, update both. The long-term goal is single source of truth.

### Importing features/ from core/app/

Components depend on the app layer. The app layer does **not** depend on components. If `core/app/` needs something from `features/`, you're breaking the dependency direction — restructure.

### Calling side effects in write operations

Wrong:
```ts
// ❌ Inside insertTransaction
await insertTransaction(params);
await upsertMerchantHint(params.merchant, params.category); // side effect!
```

Right:
```ts
// ✅ Emit an event, let a subscriber handle it
await insertTransaction(params);
eventBus.emit('transaction:created', { ... });
// Somewhere else, once:
eventBus.on('transaction:created', (tx) => {
  if (tx.merchant) merchantHintRepo.upsert(tx.merchant, tx.category);
});
```

### Mutating global state

The scheduler currently has a mutable singleton pattern (noted in CLAUDE.md as needing refactoring). The target is a class with injected dependencies, like everything else. If you touch the scheduler, move it toward that pattern.

---

## 10. Current Refactoring Status

Per CLAUDE.md, the codebase is being incrementally refactored from MVP-quality code toward the strict layered architecture described in this document. Here's what's clean vs. what still needs work:

**Clean (already following target patterns):**
- Composition root — clean wiring, all registrations in one place
- Tool registry with self-registering tools — no switch statements
- Event bus with typed events and subscribers
- Provider registry pattern
- Domain types and money utilities
- Repository interfaces in `interfaces.ts`
- Infrastructure implementations (one file per aggregate)

**Being refactored (noted in CLAUDE.md):**
- `agent.ts` — monolithic, mixed responsibilities. Target: split into pipeline steps
- `tool-executor.ts` — formerly a switch, now delegates to registry but still has legacy code
- `init.ts` — some duplicate DDL (also in schema.ts). Target: single source of truth
- `transactions-write.ts` — directly calls merchant hint upsert in some paths. Target: event bus for all side effects
- `scheduler.ts` — global mutable state. Target: class with injected dependencies
- `chat.store.ts` — directly calls agent + DB. Target: consume app-layer services via interfaces
- Various files import `* as db from '../db/client'` — Target: import repository interfaces from composition-root

**Rule of thumb when touching existing code:** move it toward the target pattern incrementally. One logical change per commit. Don't rewrite the whole file at once — that's how branches diverge and ships sink.

---

## 11. Further Reading

- **`CLAUDE.md`** — The authoritative architecture doc. Import rules, mandatory patterns, and the refactoring hit list live here. Read this whenever you're unsure about structure.
- **`feature.md`** — Full feature inventory with statuses. Every feature (15 AI tools, chat interface, dashboard, recurring, PWA, export, SMS integration) is described here. Check this before starting new work — what you're building might already be listed.
- **`package.json`** — Dependencies and scripts. Check this when you need to know what's available (date-fns for dates, Recharts for charts, jsPDF for PDFs, etc.).
- **`vite.config.ts`** — Vite + PWA config. The COOP/COEP headers, PWA manifest, and build settings are here. If deployment breaks, check this first.
- **`src/core/composition-root.ts`** — The wiring file. Annotated with comments. If you want to understand how things connect, start here.
- **`src/core/agent/agent.ts`** — The agent loop. If you want to understand how the AI processes messages, this is it.
- **`src/core/agent/system-prompt.ts`** — The system prompt. If you want to change how the AI behaves, you may need to edit this.

---

Welcome aboard. The codebase rewards understanding the patterns before writing code. Read the three files listed in section 4, then pick up a small task from CLAUDE.md's refactoring list or a bug from the issue tracker. Happy hacking.
