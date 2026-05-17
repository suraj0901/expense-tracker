# AI Expense Tracker

Agent-centric expense tracker. Log expenses by chatting — the AI handles categorization, queries, and reports. All data stays local.

## Architecture

```
browser (OPFS)
├── SQLite via SQLocal + Drizzle ORM
├── AI Agent (9 tools, agentic loop)
├── Providers: Claude (Sonnet 4), Gemini (2.0 Flash), DeepSeek
└── PWA (manifest + service worker)
```

### Data flow

```
User message → Agent loop → AI provider → Tool calls → DB
                                    ↑ (multi-turn) ↓
                              Tool results ← Tool executor
```

Money is always stored in paise (integer). Conversion happens exactly twice — at the tool executor boundary.

### File layout

```
src/
  core/
    agent/       System prompt, tool definitions, tool executor, agent loop
    db/          Schema, init, CRUD operations
    domain/      Types, money utilities
    providers/   Claude, Gemini, DeepSeek backends
    logger.ts    Structured JSON logging
  features/
    chat/        Chat UI (Zustand store, message bubbles)
    dashboard/   Monthly summary, charts (Recharts)
    settings/    Provider picker, API key management
```

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add your API key in Settings to start.

## API Keys

Supports three providers:

| Provider | Key format | Get it from |
|----------|-----------|-------------|
| Anthropic | `sk-ant-...` | https://console.anthropic.com |
| Gemini | `AIza...` | https://aistudio.google.com |
| DeepSeek | `sk-...` | https://platform.deepseek.com |

Keys stay in `localStorage`. AI calls go direct from your browser to the provider — no proxy.

## Commands

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Tech stack

- React 19, TypeScript 6, Vite 8
- SQLite (OPFS) via SQLocal + Drizzle ORM
- Zustand for client state, TanStack Router for routing
- Recharts for charts, Tailwind CSS v4
- Zod for validation, date-fns for dates
