# Changelog

All notable changes to the WIPL Ticket Intelligence Dashboard are tracked here.
Format: `[commit-hash] — date — summary`, followed by details.

---

## [c3502c2] — 2026-04-11 — Initial commit

- Added `README.md` (empty scaffold)

---

## [pending] — 2026-04-11 — Scaffold project + Feature 1 (Ticket Table) + Database Browser

### Added
- `index.html` — Vite entry point, page title set to "WIPL Ticket Intelligence Dashboard"
- `package.json` — dependencies: React 18, Vite 6, Tailwind CSS 3, @supabase/supabase-js, Recharts
- `vite.config.js` — Vite config with @vitejs/plugin-react
- `tailwind.config.js` — Tailwind content paths configured
- `postcss.config.js` — Tailwind + autoprefixer
- `.gitignore` — ignores node_modules, dist, .env, .vscode, OS files, logs
- `.env.example` — template for all 5 required environment variables
- `src/main.jsx` — React root mount
- `src/index.css` — Tailwind directives + dark scrollbar utility classes
- `src/App.jsx` — App shell with dark sidebar nav (Tickets, Database, Submit [soon], Analytics [soon], RAG [soon]), top header bar with Supabase connection indicator
- `src/lib/supabase.js` — Supabase JS client singleton using VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
- `src/components/UrgencyBadge.jsx` — color-coded badge: Critical=red, High=orange, Normal=blue, Low=gray
- `src/components/CategoryBadge.jsx` — color-coded badge: Technical=purple, Billing=yellow, Account=cyan, Feature Request=green, General=indigo
- `src/components/TicketTable.jsx` — full ticket table (Feature 1):
  - Fetches from Supabase `tickets` table with server-side filtering and pagination (25/page)
  - Filters: category, urgency, decision, date range
  - Sortable by created_at (click column header)
  - Per-row actions: Slack thread link, Supabase record link, detail side panel
  - Detail side panel: full ticket data including message, AI summary, all metadata
- `src/components/DatabaseBrowser.jsx` — Database Browser (3 tables):
  - `resolved_tickets` — id, subject, category, urgency, resolution, created_at (`embedding` vector excluded)
  - `ticket_approvals` — AI-suggested vs human-corrected category/urgency side by side, decision, RAG used, similarity
  - `ticket_suggestions` — ticket_id, subject, email, suggested_response, internal_notes (full text in modal)
  - Per table: subject search (debounced), pagination, row detail modal, refresh button

### Environment variables required (see `.env.example`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_N8N_WEBHOOK_URL` (placeholder, used in Feature 2)
- `VITE_N8N_THREAD_WEBHOOK_URL` (placeholder, used in Feature 3)
- `VITE_SLACK_CHANNEL_ID`

### Not yet built (upcoming)
- Feature 2: Submit new ticket form + n8n webhook POST + Supabase polling
- Feature 3: Thread update side panel
- Feature 4: Suggested response viewer
- Feature 5: Analytics (metric cards + Recharts charts)
- Feature 6: RAG knowledge base viewer
