# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# storage
- Store data in local filesystem rather than localStorage. Confidence: 0.65

# ai
- Use LFM 2.5 350M model for local AI provider via Transformers.js (or similar tooling that supports LFM and works on Android), not WebLLM. Confidence: 0.75

# agent
- Detect user patterns (merchant→category mappings, recurring transactions) and confirm with user before acting. Never re-ask a dismissed suggestion — respect both accept and dismiss decisions permanently. Auto-apply confirmed patterns thereafter. Confidence: 0.75
- In the UI, only show active rules — do not display pending suggestions or dismissed history. Confidence: 0.70
- Auto-log rules belong in their own dedicated tab (Recurring), not on the Settings page. Confidence: 0.70
- Two distinct notification types for recurring patterns: (1) Timed log suggestions — trigger at the pattern's specific day/time asking "wanna log this again?" (e.g., breakfast at 8:30am Wed/Fri). (2) Rule-creation suggestions — for consistent patterns like rent, ask "wanna create a rule?" and can fire anytime. Confidence: 0.75
- Pre-generate AI notification content variants and cache them — do not call the AI live at notification time. The AI generates natural-language notification bodies when the pattern is first detected, and notifications pull from the cache. Keep a static fallback for when the cache is empty. Confidence: 0.70

# architecture
- Use direct DB calls for explicit UI actions (delete button clicks, suggestion chip taps) rather than routing through the AI tool loop. Reserve AI tool loop for conversational/natural-language interactions. Confidence: 0.65
- Chat UI should be an event list: direct transaction logs appear inline, while queries combine the query and AI response into a single card added to the event list. Confidence: 0.70

# ui
See [ui/taste.md](ui/taste.md)

# settings
- Co-locate API key inputs with their corresponding AI provider selection — do not separate them into distinct sections. Confidence: 0.70
- Keep Export (CSV/PDF) separate from Backup & Restore as distinct sections; make export buttons describe what exactly they export (e.g., "Export transactions as CSV"). Confidence: 0.70
- Auto-download the local AI model as soon as it is selected — do not require the user to manually click a download button each time. Confidence: 0.75
