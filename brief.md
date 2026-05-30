# ExpenseTracker — Design Constitution

## Register
**Product** — an instrument for daily personal finance. The interface earns trust through consistency, speed, and data presence. This is not a brand experience.

## Users and context
Individuals tracking personal expenses on mobile devices. They open the app briefly — logging a purchase, checking this month's spend, reviewing a category. Sessions are short and task-focused. The user is mid-task, not browsing.

## Core purpose
Log expenses and income via chat (AI-assisted categorization), monitor spending through dashboard charts and category breakdowns, and manage recurring expense rules. All data stays local (OPFS/SQLite). Works offline as a PWA.

## Primary job patterns
- **Chat view → Operate** — command bar (chat input) as primary tool, feed of transaction cards and AI responses, inline actions (edit, delete, undo)
- **Dashboard → Monitor** — summary metrics, charts, category breakdowns with drill-down
- **Settings → Configure** — provider selection with co-located API key inputs, export, backup & restore, about
- **Recurring → Configure** — auto-log rule management, enable/disable, remove

## Voice
Direct, minimal, confident. The app is a tool. Copy names the action precisely — one verb per button. No filler, no exclamation points, no marketing. Sentence case everywhere.

## Anti-references
- Generic fintech: navy blue, serif fonts, gold accents, cream backgrounds
- Over-designed: excessive glass morphism, gradient cards everywhere, decorative depth
- Data-sparse: placeholder-heavy dashboards with no real content
- Marketing landing page patterns: centered heroes, value props, testimonial cards
- SaaS in cream-and-purple, developer tools in terminal-mono-on-dark

## Visual foundation
- **Type**: Inter (sans), JetBrains Mono (mono). System font fallbacks. Body at 0.8125–0.875rem.
- **Color — dark (default)**: Deep navy-black background (#0a0a0f), emerald green accent (#10b981), pink expense (#f472b6), green income (#34d399). Green is rare enough to mean something.
- **Color — light**: Warm off-white background (#f8f9fc), deeper emerald accent (#059669). Same role colors, adjusted for light context.
- **Layout**: Phone-shaped container (max-width 480px), bottom tab navigation, header at 52px, nav at 64px + safe area. Sharp corners in chat feed (per taste), rounded corners elsewhere at 8–16px.
- **Depth**: Background (dark surface), content (cards, inputs), attention (modals, sheets animated from bottom). Backdrop blur on header and nav for spatial separation.
- **Motion**: Page transitions at 180–220ms, message entrance at 250ms, bottom sheets slide up. Respects `prefers-reduced-motion`.

## Accessibility
- Dark/light theme toggle persisted to localStorage
- Focus-visible states on all interactive elements (accent border + glow on inputs)
- Touch targets minimum 44px (nav items, chips, buttons)
- Color not the sole differentiator for expense vs income (icons accompany amounts)

## Taste preferences (recorded)
- Sharp corners on transaction/event cards in chat UI
- Feed items in reverse-chronological order (newest at top)
- Tabs for All / Transactions / Queries (not filter pills)
- Compact chat: unified padding, small headers, dead space minimized
- Category drill-down: total amount right-aligned in header, count as subtext
- Tags displayed horizontally within cards
- SmartHeader: today's expense large and clean, no pill/badge wrapper
- TransactionCard: time above amount (right side), tags alongside category, description as subtext
- List views prefer flat lists over card-wrapped items
- Horizontal margin maintained on cards — not edge-to-edge
- API key inputs co-located with provider selection
- Export and backup/restore as separate sections; export buttons describe what they export
