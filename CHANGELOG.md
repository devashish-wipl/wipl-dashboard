# Changelog

All notable changes to the WIPL Ticket Intelligence Dashboard are tracked here.
Format: `[commit-hash] — date — summary`, followed by details.

---

## [c3502c2] — 2026-04-11 — Initial commit

- Added `README.md` (empty scaffold)

---

## [dc1fbaa] — 2026-04-11 — Scaffold project + Feature 1 (Ticket Table) + Database Browser

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
- Feature 2: Submit new ticket form + n8n webhook POST + Supabase polling ✅ done in next commit
- Feature 3: Thread update side panel
- Feature 4: Suggested response viewer
- Feature 5: Analytics (metric cards + Recharts charts)
- Feature 6: RAG knowledge base viewer

---

## [af1bc3b] — 2026-04-11 — Feature 2: Submit Ticket form + n8n webhook + Supabase polling

### Added
- `src/components/SubmitTicket.jsx` — full submit ticket feature:
  - Form with subject, email, message fields + inline validation
  - POSTs to `VITE_N8N_WEBHOOK_URL` with `{ subject, message, email }` and `ngrok-skip-browser-warning` header
  - Uses `AbortController` with 10s timeout — treats timeout as "sent" (expected: n8n hangs on `sendAndWait` Slack node)
  - Genuine network errors (connection refused) shown as error state
  - Pipeline step indicator auto-advances through: Send → Jina → RAG → LLM → Slack → DB
  - Polls `tickets` table every 3s (subject + email + created_at >= submission time) for up to 5 minutes
  - After ticket found: secondary lookup on `ticket_approvals` (subject + email) to fetch `decision`, `correct_category`, `correct_urgency` — merged onto ticket before display
  - Success card: shows corrected category/urgency badges (falls back to AI classification if no correction), decision badge (Approved/Rejected/Pending), AI summary, copyable ticket ID, Slack thread link
  - Timeout state (5 min): shows "Keep checking" button (resets poll window) and "Submit another" option
  - Error state: shows specific message for unconfigured webhook URL or network failure
  - Webhook URL warning banner shown if `VITE_N8N_WEBHOOK_URL` still contains placeholder value

### Modified
- `src/App.jsx` — wired in `SubmitTicket` component; moved Submit Ticket nav item to position 2 (removed "soon" tag); Database moved to position 3
- `.env` — updated `VITE_N8N_WEBHOOK_URL` and `VITE_N8N_THREAD_WEBHOOK_URL` with live ngrok URL (not committed — .gitignore)

### Bug fixes
- Decision badge showed empty on success card — `decision` is not written to `tickets` table by n8n (only to `ticket_approvals`); fixed by secondary lookup + "Pending" fallback
- Success card content clipped at bottom — fixed by changing `py-8` to `pt-8 pb-16` on scroll container

### Not yet built (upcoming)
- Feature 3: Thread update side panel
- Feature 4: Suggested response viewer
- Feature 5: Analytics (metric cards + Recharts charts)
- Feature 6: RAG knowledge base viewer

---

## [7ab004a] — 2026-04-11 — Add CLAUDE.md project context file

### Added
- `CLAUDE.md` — comprehensive project context document covering: project overview, full tech stack, all environment variables, both n8n workflow pipelines with payloads, all 5 Supabase table schemas with column details, Slack URL construction pattern, feature completion status, established code patterns, and known issues/gotchas table

### Modified
- `CHANGELOG.md` — backfilled commit hash for `af1bc3b` entry

---

## [pending] — 2026-04-11 — Backfill CHANGELOG entries + document commit workflow rule in CLAUDE.md

### Modified
- `CHANGELOG.md` — backfilled commit hash for `7ab004a`; added this entry before pushing (per commit workflow rule)
- `CLAUDE.md` — added commit workflow rule: always update CHANGELOG with the commit's changes before committing and pushing
