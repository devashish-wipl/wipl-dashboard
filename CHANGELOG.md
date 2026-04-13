# Changelog

All notable changes to the WIPL Ticket Intelligence Dashboard are tracked here.
Format: `[commit-hash] — date — summary`, followed by details.

---

## [pending] — 2026-04-13 — docs: update CLAUDE.md to reflect bf0fa16 changes

### Modified
- `CLAUDE.md` — Feature 1 description updated: added search and decision-filter workaround notes; Database Browser tab count updated to 4 (groq_errors added); App.jsx file comment updated to mention real health check; Decision field gap pattern updated to describe the pre-fetch workaround; Known Issues row updated to match

---

## [bf0fa16] — 2026-04-13 — fix: decision filter, search, groq_errors viewer, connection status, cleanup

### Fixed
- `src/components/TicketTable.jsx` — decision filter was broken (tickets.decision is always null); now pre-fetches matching subjects from ticket_approvals via ilike, then filters tickets with `.in('subject', ...)` so Approved/Rejected filtering actually works
- `src/components/RAGKnowledgeBase.jsx` — removed dead `ScoreBadge` reference (component was deleted in previous commit but the conditional render branch referencing it remained)

### Added
- `src/components/TicketTable.jsx` — subject/email search input in the filter bar (debounced 350ms); uses Supabase `.or('subject.ilike.%X%,email.ilike.%X%')`; reset clears search alongside filters
- `src/components/DatabaseBrowser.jsx` — groq_errors table tab added; columns: id, subject, email, error_message, rag_used, failed_at; previously classification failures had no viewer in the dashboard

### Changed
- `src/App.jsx` — connection status dot now does a real Supabase health check on mount (count query against tickets); shows yellow "Connecting…", green "Connected", or red "Supabase unreachable" instead of hardcoded green
- `src/App.jsx` — removed `soon` dead code from nav render (no NAV_ITEMS have `soon: true`; the conditional branch and "Soon" badge were unreachable)
- `src/App.jsx` — version bumped from v0.1.0 to v1.0.0

---

## [d9b817b] — 2026-04-13 — docs: mark all features complete in CLAUDE.md

### Modified
- `CLAUDE.md` — moved Features 3–6 from "Not Yet Built" to "Complete"; updated file structure listing to include all 6 feature components; removed "(upcoming)" from Recharts entry; updated Feature 3 webhook description tense; removed `combined_score` from Feature 6 column list

---

## [a01ac08] — 2026-04-13 — fix: remove combined_score from RAG Knowledge Base viewer

### Fixed
- `src/components/RAGKnowledgeBase.jsx` — removed `combined_score` from SELECT query, table columns, row detail modal, and sort options; removed `ScoreBadge` component; changed default sort from `combined_score` to `created_at`; sort options now "Newest" (created_at) and "ID" — `combined_score` was causing a query error

---

## [073f39b] — 2026-04-13 — feat: add Feature 6 - RAG Knowledge Base viewer

### Added
- `src/components/RAGKnowledgeBase.jsx` — read-only viewer for `resolved_tickets` table (embedding excluded); columns: subject, category, urgency, resolution, combined_score; `ScoreBadge` colors score green ≥ 0.5, yellow ≥ 0.1, gray < 0.1; subject search (debounced 350ms); sort toggle between combined_score and created_at; pagination (25/page); row detail modal showing full message + all fields; entry count displayed in header

### Modified
- `src/App.jsx` — imports `RAGKnowledgeBase`; removes `soon: true` from the `rag` nav item; renders `<RAGKnowledgeBase />` for the `rag` tab; removes the old "Coming soon" fallback div

---

## [432f676] — 2026-04-13 — feat: add Feature 5 - Analytics dashboard

### Added
- `src/components/Analytics.jsx` — full analytics page: 5 metric cards (total tickets, approval rate, rejection rate, RAG hit rate, avg similarity score); tickets by category bar chart with per-category colors; tickets by urgency horizontal bar chart; ticket volume over time line chart; all data fetched from `tickets` + `ticket_approvals` tables; loading/error/empty states per chart

### Modified
- `src/App.jsx` — imports `Analytics`; removes `soon: true` from analytics nav item; renders `<Analytics />` for the `analytics` tab; updates the fallback "Coming soon" condition to exclude `analytics`

---

## [a618dc2] — 2026-04-13 — feat: add Feature 4 - Suggested Response Viewer panel

### Added
- `src/components/SuggestedResponsePanel.jsx` — slide-in side panel that fetches `ticket_suggestions` by `ticket_id` from Supabase; shows `suggested_response` with copy-to-clipboard button; shows `internal_notes` in a collapsible section; handles loading, error, and empty ("no suggestion generated") states
- `SuggestionIcon` helper in `src/components/TicketTable.jsx` — lightbulb SVG icon for the new action button

### Modified
- `src/components/TicketTable.jsx` — imports `SuggestedResponsePanel`; adds `suggestionTicket` state; adds suggestion button (indigo, lightbulb icon) in actions column; renders `<SuggestedResponsePanel>` panel; all three panel open-handlers mutually close each other

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

## [531d147] — 2026-04-13 — Fix CORS on n8n webhook calls via Vite dev proxy

### Problem
`ThreadUpdatePanel` hit a CORS preflight failure when POSTing directly to the ngrok URL. The n8n `dashboard-update` webhook does not return `Access-Control-Allow-Origin` headers, so the browser blocked the OPTIONS preflight request.

### Fix
- `vite.config.js` — switched to `defineConfig(({ mode }) => ...)` factory form; added `server.proxy` that routes all `/webhook/*` requests to the ngrok origin (extracted from `VITE_N8N_WEBHOOK_URL` at dev-server start via `loadEnv`). Falls back to `http://localhost:5678` if env var is missing or placeholder. The proxy runs server-to-server so the browser sees only same-origin requests — no CORS.
- `src/components/ThreadUpdatePanel.jsx` — added `webhookPath()` helper that strips the origin from the full env var URL, leaving just the pathname (e.g. `/webhook/dashboard-update`); fetch now uses this path. Also set `Content-Type: application/json; charset=utf-8` to silence n8n's `missing_charset` warning.
- `src/components/SubmitTicket.jsx` — same `webhookPath()` helper and path-only fetch applied for consistency (pre-emptive fix).

### n8n changes (context, not dashboard code)
- Created new workflow copying the Slack update handler with path `/webhook/dashboard-update`
- Removed Slack-interactive-component assumptions; added validation Code node to normalize payload and require `ticket_id` (must be real Supabase UUID)
- Fixed `Fetch Ticket Thread TS` and `Prepare Thread Reply` nodes; moved webhook response to end of flow
- Verified end-to-end: Supabase PATCH succeeds, thread metadata fetched, Slack posts reply with `ok: true`

Note: `VITE_N8N_THREAD_WEBHOOK_URL` must be updated in `.env` to use the new `/webhook/dashboard-update` path, and `npm run dev` restarted after any `.env` change.

---

## [7ec7826] — 2026-04-13 — Feature 3: Thread Update Panel

### Added
- `src/components/ThreadUpdatePanel.jsx` — side panel for sending Slack thread updates per ticket:
  - Ticket context strip at top: urgency/category badges, current status, email
  - Form fields: Update Type dropdown (Status Update / Assignment / Custom Reply / Full Update), Status dropdown (Open/In Progress/Resolved/Escalated), Assign To text input, ETA free-text input, Custom Message textarea
  - POSTs to `VITE_N8N_THREAD_WEBHOOK_URL` with `{ ticket_id, slack_thread_ts, update_type, assigned_to, eta, status, custom_message }` and `ngrok-skip-browser-warning` header
  - 20s `AbortController` timeout — treats timeout as error (unlike classifier, no sendAndWait blocking)
  - Validates at least one field is filled before submitting
  - Success card: summarises what was sent, link to Slack thread, "Send another update" reset
  - Error state: specific messages for timeout, network failure, non-2xx response
  - Warning banner if `VITE_N8N_THREAD_WEBHOOK_URL` is unconfigured
  - Warning if ticket has no `slack_thread_ts` / `thread_ts`

### Modified
- `src/components/TicketTable.jsx` — wired in ThreadUpdatePanel:
  - Imported `ThreadUpdatePanel`
  - Added `updateTicket` state alongside existing `selectedTicket`
  - Added "Send thread update" action button (orange/send icon) per row, opens ThreadUpdatePanel and closes DetailPanel
  - Opening DetailPanel closes ThreadUpdatePanel and vice versa
  - Added `SendUpdateIcon` SVG helper

---

## [efd2d86] — 2026-04-11 — Backfill CHANGELOG entries + document commit workflow rule in CLAUDE.md

### Modified
- `CHANGELOG.md` — backfilled commit hash for `7ab004a`; added this entry before pushing (per commit workflow rule)
- `CLAUDE.md` — added commit workflow rule: always update CHANGELOG with the commit's changes before committing and pushing
