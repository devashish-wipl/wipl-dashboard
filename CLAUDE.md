# CLAUDE.md — WIPL Ticket Intelligence Dashboard

This file is the authoritative context document for this project. Read it at the start of every session before making changes.

---

## Commit Workflow Rule

**Always update `CHANGELOG.md` before committing and pushing.** Every commit must have its entry written in `CHANGELOG.md` first — including the files changed and what was done — before `git commit` is run. The commit message and the changelog entry should describe the same changes. After the commit is made, backfill the real commit hash into the `[pending]` placeholder in the changelog entry.

Correct order:
1. Make code changes
2. Write the `[pending]` entry in `CHANGELOG.md` describing those changes
3. `git add` all changed files including `CHANGELOG.md`
4. `git commit` with the message
5. Replace `[pending]` with the real commit hash in `CHANGELOG.md`
6. `git add CHANGELOG.md && git push`

---

## What This Project Is

A React-based internal dashboard for **Webspiders Interweb Pvt Ltd (WIPL)**, an IT infrastructure and web hosting company (wiplon.com). It provides a GUI over an existing **n8n automation + Supabase** backend that classifies, approves, and logs customer support tickets.

The dashboard does **not** have its own backend. All data access goes directly through the Supabase JS client. The n8n workflows run independently — this dashboard is purely a consumer and trigger layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 (dark theme, `bg-gray-950` base) |
| Database client | `@supabase/supabase-js` v2 |
| Charts | Recharts |
| Dev server | `npm run dev` → `http://localhost:5173` |
| Build | `npm run build` → `dist/` |

No backend server. No React Router (single-page, tab-based nav). No state management library.

---

## Environment Variables

All variables live in `.env` (gitignored). Copy `.env.example` to get started.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL — `https://dfjecxfmqudfcykmypdg.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key for JS client auth |
| `VITE_N8N_WEBHOOK_URL` | Full ngrok URL for the RAG classifier webhook — changes every ngrok restart on the free plan |
| `VITE_N8N_THREAD_WEBHOOK_URL` | Full ngrok URL for the thread update webhook — same ngrok session, different path |
| `VITE_SLACK_CHANNEL_ID` | `C0APTM3L9RS` — used to construct Slack thread deep-link URLs |

**Important:** `VITE_N8N_WEBHOOK_URL` and `VITE_N8N_THREAD_WEBHOOK_URL` use a free ngrok account. The subdomain changes on every `ngrok` restart. Update both values in `.env` and restart `npm run dev` when the URL changes. The app shows a warning banner if the webhook URL still contains the placeholder string `your-ngrok-url`.

The Supabase client singleton is at `src/lib/supabase.js` — it throws at startup if either Supabase env var is missing.

---

## n8n Workflows

Two workflows run on n8n at `http://localhost:5678`, exposed publicly via ngrok.

### 1. WIPL Hybrid RAG Classifier (`/webhook/rag-classifier-copy`)

**Trigger:** `POST {ngrok-url}/webhook/rag-classifier-copy`

**Expected body:**
```json
{ "subject": "string", "message": "string", "email": "string" }
```

**Pipeline (in order):**
1. Extract ticket fields
2. Jina AI (`jina-embeddings-v2-base-en`) — generate embedding for subject+message
3. Supabase `hybrid_search` RPC — semantic + keyword search against `resolved_tickets`, threshold `combined_score >= 0.032`
4. Build RAG prompt (includes context if score >= threshold, skips if not)
5. LLM Chain (Groq `openai/gpt-oss-120b` primary, `llama-3.3-70b-versatile` fallback) — classify into category + urgency + summary. JSON output parser with auto-fix fallback model (`kimi-k2-instruct-0905`)
6. **Slack `sendAndWait`** — posts approval card to `C0APTM3L9RS`, PAUSES execution until a human approves or corrects in Slack
7. On approval/rejection: writes to `ticket_approvals`, embeds ticket via Jina, upserts to `resolved_tickets`
8. Inserts final ticket into `tickets` table
9. Links suggestion to ticket in `ticket_suggestions` (backfills `ticket_id` by subject+email match)
10. Posts Slack thread message, updates `thread_ts` on the ticket row

**Critical behaviour for the dashboard:** The webhook does NOT respond promptly. The `sendAndWait` node blocks the HTTP response until a human acts in Slack. The dashboard `SubmitTicket` component handles this with a 10-second `AbortController` timeout — a timeout is treated as "received", not an error.

**LLM also runs in parallel:** `LLM - Generate Suggested Response` runs concurrently with the Slack approval step, writing to `ticket_suggestions` before the ticket ID exists. The `ticket_id` FK is backfilled via a PATCH by subject+email after `Supabase - Insert Ticket` completes.

**Categories:** `Technical`, `Billing`, `Account`, `Feature Request`, `General`
**Urgencies:** `Critical`, `High`, `Normal`, `Low`

---

### 2. WIPL Ticket Update Handler (`/webhook/ticket-update`)

**Trigger:** `POST {ngrok-url}/webhook/ticket-update`

This webhook is used by Slack's interactive components (buttons in ticket thread messages), not directly by the dashboard yet. It handles:
- `update_ticket` button → opens a Slack modal for status/ETA/assignee/custom reply
- `view_suggested_reply` button → fetches from `ticket_suggestions` and opens a read-only Slack modal
- Modal submissions → PATCHes `tickets` table, fetches `thread_ts`, posts reply to Slack thread

**Dashboard feature for this webhook (Feature 3):** POSTs directly from the Thread Update panel with body:
```json
{
  "ticket_id": "string",
  "slack_thread_ts": "string",
  "update_type": "string",
  "assigned_to": "string",
  "eta": "string",
  "status": "string",
  "custom_message": "string"
}
```

---

## Supabase Tables

Supabase instance: `https://dfjecxfmqudfcykmypdg.supabase.co`

### `tickets`
The main table. Populated by n8n after Slack approval.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated primary key |
| `subject` | text | |
| `message` | text | |
| `email` | text | |
| `category` | text | Technical / Billing / Account / Feature Request / General |
| `urgency` | text | Critical / High / Normal / Low |
| `summary` | text | LLM-generated one-liner |
| `status` | text | Open / In Progress / Resolved / Escalated |
| `rag_used` | boolean | Whether combined_score >= 0.032 |
| `max_similarity` | float | Highest combined_score from hybrid search |
| `slack_thread_ts` | text | Slack thread timestamp (e.g. `1234567890.123456`) |
| `thread_ts` | text | Same as above (used by update handler workflow) |
| `slack_channel` | text | Slack channel ID |
| `created_at` | timestamptz | Set by Supabase |
| `approved_by` | text | Not currently populated by n8n |
| `decision` | text | **NOT set by n8n on insert** — only in `ticket_approvals` |

**Known gap:** `decision` is null on all rows in `tickets`. The actual decision lives in `ticket_approvals`. The `SubmitTicket` success card does a secondary lookup on `ticket_approvals` to fetch it.

### `ticket_approvals`
Written by n8n immediately after the Slack approval/rejection decision — before the `tickets` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | int | Auto-increment |
| `subject` | text | |
| `email` | text | |
| `suggested_category` | text | AI's original classification |
| `suggested_urgency` | text | AI's original classification |
| `summary` | text | |
| `decision` | text | `Approved` or `Rejected` |
| `correct_category` | text | Human-corrected (same as suggested if approved) |
| `correct_urgency` | text | Human-corrected (same as suggested if approved) |
| `rag_used` | boolean | |
| `max_similarity` | float | Nullable |
| `reviewed_at` | timestamptz | |

**No FK to `tickets`.** Join must be done by `subject + email`. This is a design limitation of the n8n workflow.

### `ticket_suggestions`
LLM-generated customer-facing responses and internal notes. Written concurrently with the Slack approval step.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `ticket_id` | uuid | FK to `tickets.id` — backfilled after ticket insert via subject+email PATCH |
| `subject` | text | |
| `email` | text | |
| `suggested_response` | text | Long-form customer response from LLM |
| `internal_notes` | text | Action flags, escalation notes, upsell opportunities from LLM |
| `created_at` | timestamptz | |

### `resolved_tickets`
The pgvector RAG knowledge base. New tickets are upserted here after approval.

| Column | Type | Notes |
|---|---|---|
| `id` | text | `approved_{timestamp}` or `corrected_{timestamp}` or `TKT-XXX` |
| `subject` | text | |
| `message` | text | |
| `category` | text | |
| `urgency` | text | |
| `resolution` | text | Human-readable resolution note |
| `embedding` | vector | Jina `jina-embeddings-v2-base-en` — **always exclude from SELECT** |
| `combined_score` | float | Used for hybrid search threshold |
| `created_at` | timestamptz | |

**Always use a custom `selectClause` that excludes `embedding`** when querying this table. Fetching the vector column returns a massive float array that is useless in the UI and blows up response size.

### `groq_errors`
Classification failure log. Written when the LLM chain fails entirely.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `subject` | text | |
| `email` | text | |
| `error_message` | text | |
| `failed_at` | timestamptz | |
| `rag_used` | boolean | |

---

## Slack Integration

- **Channel:** `C0APTM3L9RS`
- **Thread URL pattern:** `https://wipl.slack.com/archives/C0APTM3L9RS/p{slack_thread_ts_without_dot}`
  - Example: `thread_ts = 1234567890.123456` → URL ends in `p1234567890123456`
  - Helper already in `TicketTable.jsx`: `slackThreadUrl(ts)`

---

## Project File Structure

```
wipl-dashboard/
├── .env                        # gitignored — fill from .env.example
├── .env.example                # template for all 5 vars
├── .gitignore
├── CHANGELOG.md                # per-commit change log
├── CLAUDE.md                   # this file
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── src/
    ├── main.jsx                # React root
    ├── index.css               # Tailwind directives + scrollbar utilities
    ├── App.jsx                 # Shell: sidebar nav, top header, tab routing
    ├── lib/
    │   └── supabase.js         # Supabase client singleton
    └── components/
        ├── UrgencyBadge.jsx          # Shared badge — Critical/High/Normal/Low
        ├── CategoryBadge.jsx         # Shared badge — 5 categories
        ├── TicketTable.jsx           # Feature 1: ticket list
        ├── SubmitTicket.jsx          # Feature 2: submit form + polling
        ├── ThreadUpdatePanel.jsx     # Feature 3: thread update via n8n webhook
        ├── SuggestedResponsePanel.jsx # Feature 4: suggested response viewer
        ├── Analytics.jsx             # Feature 5: analytics dashboard
        ├── RAGKnowledgeBase.jsx      # Feature 6: RAG knowledge base viewer
        └── DatabaseBrowser.jsx       # Database viewer (3 tables)
```

---

## Features — Status

### ✅ Complete

**Feature 1 — Ticket Table** (`TicketTable.jsx`)
- Fetches `tickets` table with server-side filters (category, urgency, decision, date range)
- Pagination: 25/page, sortable by `created_at`
- Per-row: Slack thread link, Supabase record link, detail side panel
- Detail panel: full message, AI summary, all metadata

**Feature 2 — Submit Ticket** (`SubmitTicket.jsx`)
- Form with inline validation
- POST to n8n webhook with `ngrok-skip-browser-warning` header
- 10s AbortController timeout (expected — n8n hangs on sendAndWait)
- Polls `tickets` every 3s for up to 5 minutes
- Secondary lookup on `ticket_approvals` for decision + corrected classification
- Pipeline step indicator, 5-min countdown, timeout/error states
- Success card with corrected badges, decision, AI summary, copyable ID, Slack link

**Database Browser** (`DatabaseBrowser.jsx`)
- Tabs: `resolved_tickets`, `ticket_approvals`, `ticket_suggestions`
- Subject search (debounced 350ms), pagination, refresh
- Row detail modal (full untruncated content)
- `embedding` column excluded from `resolved_tickets` query

**Feature 3 — Thread Update Panel** (`ThreadUpdatePanel.jsx`)
- Side panel per ticket
- Fields: assigned_to, ETA, status dropdown, custom message
- POST to `VITE_N8N_THREAD_WEBHOOK_URL` with `{ ticket_id, slack_thread_ts, update_type, assigned_to, eta, status, custom_message }`
- Shows confirmation on submit

**Feature 4 — Suggested Response Viewer** (`SuggestedResponsePanel.jsx`)
- Per ticket, fetches `ticket_suggestions` by `ticket_id`
- Displays `suggested_response` with copy-to-clipboard
- Displays `internal_notes` in a collapsible section
- "No suggestion generated" fallback

**Feature 5 — Analytics** (`Analytics.jsx`)
- Metric cards: total tickets, approval rate, rejection rate, RAG hit rate
- Tickets by category — bar chart (Recharts)
- Tickets by urgency — breakdown
- Ticket volume over time — by day (Recharts)
- Average similarity score for RAG-used tickets
- All computed from Supabase `tickets` + `ticket_approvals` data

**Feature 6 — RAG Knowledge Base Viewer** (`RAGKnowledgeBase.jsx`)
- Read-only table from `resolved_tickets` (embedding excluded)
- Columns: subject, category, urgency, resolution
- Useful for understanding what's in the vector store

---

## Code Patterns & Decisions

### Supabase queries
- All queries are inline in component files — no separate data layer. Fine for current scale.
- Always use `{ count: 'exact' }` on paginated queries to get total row count.
- `resolved_tickets` must always use a custom `selectClause` excluding `embedding`. Pattern established in `DatabaseBrowser.jsx`.

### Badge components
- `UrgencyBadge` and `CategoryBadge` are shared. Import from `../components/UrgencyBadge` etc.
- Do not duplicate badge logic inline — always use these components.

### Slack thread URL construction
```js
// ts = "1234567890.123456"
const url = `https://wipl.slack.com/archives/${SLACK_CHANNEL}/p${ts.replace('.', '')}`
```
This helper exists in both `TicketTable.jsx` and `SubmitTicket.jsx`. If needed in more places, extract to `src/lib/slack.js`.

### n8n webhook fetch pattern
```js
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(), 10000)
try {
  await fetch(url, { signal: controller.signal, headers: { 'ngrok-skip-browser-warning': 'true' } })
  clearTimeout(timer)
} catch (err) {
  clearTimeout(timer)
  if (err.name !== 'AbortError') throw err  // real error
  // AbortError = timeout = treat as received
}
```
Always include `ngrok-skip-browser-warning: true` on all n8n webhook requests — without it, ngrok's interstitial page returns HTML instead of passing through to n8n.

### Decision field gap
`tickets.decision` is always `null`. The actual decision is in `ticket_approvals.decision`, joined by `subject + email`. This is a known n8n workflow limitation — the `Prepare Tickets Insert` node does not include the decision. Do not try to fix this in the dashboard; fix it in the n8n workflow if it matters.

### Tab routing
`App.jsx` uses simple `useState` — no React Router. To add a new tab: add an entry to `NAV_ITEMS`, add an icon function, add a conditional render in the content area.

### Dark theme
All UI uses Tailwind dark palette: `bg-gray-950` (page), `bg-gray-900` (sidebar/header), `bg-gray-800` (inputs/cards). Never use light-mode classes. The Tailwind config does not use `darkMode: 'class'` — the theme is always dark.

### ngrok free plan
The ngrok subdomain changes on every restart. When it changes:
1. Update `VITE_N8N_WEBHOOK_URL` and `VITE_N8N_THREAD_WEBHOOK_URL` in `.env`
2. Restart `npm run dev` (Vite bakes env vars at build/dev start)
3. Do NOT commit the new URL — `.env` is gitignored

---

## Known Issues / Gotchas

| Issue | Location | Notes |
|---|---|---|
| `tickets.decision` always null | `tickets` table | Decision only in `ticket_approvals`. SubmitTicket does secondary lookup. TicketTable shows `—` for existing tickets. |
| `ticket_approvals` has no FK to `tickets` | n8n workflow design | All joins must use `subject + email`. Risk of false matches if same subject+email submitted twice. |
| `ticket_suggestions.ticket_id` may be null briefly | n8n timing | Backfilled after ticket insert. If you query suggestions immediately after ticket creation, `ticket_id` may be null. |
| ngrok URL changes on restart | `.env` | Both webhook URLs must be updated manually. Dashboard shows a warning banner if placeholder detected. |
| n8n webhook hangs until Slack approval | n8n `sendAndWait` | Expected. `SubmitTicket` uses 10s AbortController. Do not increase timeout — it will block the browser tab. |
| `embedding` column in `resolved_tickets` | Supabase | Never SELECT `*` on this table — always specify columns to exclude `embedding`. |
