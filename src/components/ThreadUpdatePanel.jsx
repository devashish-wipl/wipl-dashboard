import { useState } from 'react'
import UrgencyBadge from './UrgencyBadge'
import CategoryBadge from './CategoryBadge'

const THREAD_WEBHOOK_URL = import.meta.env.VITE_N8N_THREAD_WEBHOOK_URL || ''
const SLACK_CHANNEL = import.meta.env.VITE_SLACK_CHANNEL_ID || 'C0APTM3L9RS'

// Use only the pathname for the fetch so the Vite dev proxy handles the origin.
// This avoids browser CORS preflight failures against the ngrok URL.
function webhookPath(fullUrl) {
  try { return new URL(fullUrl).pathname } catch { return fullUrl }
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Escalated']
const UPDATE_TYPE_OPTIONS = [
  { value: 'status_update',  label: 'Status Update' },
  { value: 'assign',         label: 'Assignment' },
  { value: 'custom_reply',   label: 'Custom Reply' },
  { value: 'full_update',    label: 'Full Update' },
]

const DEFAULT_FORM = {
  update_type: 'status_update',
  status: '',
  assigned_to: '',
  eta: '',
  custom_message: '',
}

function slackThreadUrl(ts) {
  if (!ts) return null
  return `https://wipl.slack.com/archives/${SLACK_CHANNEL}/p${ts.replace('.', '')}`
}

// ── Warning banner ────────────────────────────────────────────────────────────
function WebhookWarning() {
  if (!THREAD_WEBHOOK_URL || THREAD_WEBHOOK_URL.includes('your-ngrok-url')) {
    return (
      <div className="mx-6 mt-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-300 text-xs leading-relaxed">
        <strong>Webhook not configured.</strong> Set <code className="font-mono bg-yellow-900/40 px-1 rounded">VITE_N8N_THREAD_WEBHOOK_URL</code> in <code className="font-mono bg-yellow-900/40 px-1 rounded">.env</code> and restart the dev server.
      </div>
    )
  }
  return null
}

// ── Success card ──────────────────────────────────────────────────────────────
function SuccessCard({ ticket, payload, onReset }) {
  return (
    <div className="px-6 py-5 space-y-4">
      {/* check icon */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-100">Update sent</p>
          <p className="text-xs text-gray-500">n8n received the request and will post to the Slack thread.</p>
        </div>
      </div>

      {/* summary */}
      <div className="bg-gray-800/60 rounded-xl p-4 space-y-2 text-xs">
        <SummaryRow label="Ticket" value={ticket.subject} />
        <SummaryRow label="Update type" value={UPDATE_TYPE_OPTIONS.find(o => o.value === payload.update_type)?.label ?? payload.update_type} />
        {payload.status        && <SummaryRow label="Status"      value={payload.status} />}
        {payload.assigned_to   && <SummaryRow label="Assigned to" value={payload.assigned_to} />}
        {payload.eta           && <SummaryRow label="ETA"         value={payload.eta} />}
        {payload.custom_message && (
          <div>
            <p className="text-gray-500 uppercase tracking-wider font-medium mb-0.5">Message</p>
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{payload.custom_message}</p>
          </div>
        )}
      </div>

      {ticket.slack_thread_ts && (
        <a
          href={slackThreadUrl(ticket.slack_thread_ts)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-2 transition-colors w-fit"
        >
          <SlackIcon />
          View Slack thread
        </a>
      )}

      <button
        onClick={onReset}
        className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded-lg px-4 py-2 transition-colors"
      >
        Send another update
      </button>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 uppercase tracking-wider font-medium w-24 shrink-0">{label}</span>
      <span className="text-gray-300">{value}</span>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ThreadUpdatePanel({ ticket, onClose }) {
  const [form, setForm]     = useState(DEFAULT_FORM)
  const [phase, setPhase]   = useState('idle')   // 'idle' | 'submitting' | 'success' | 'error'
  const [error, setError]   = useState(null)
  const [sentPayload, setSentPayload] = useState(null)

  if (!ticket) return null

  const webhookUnconfigured = !THREAD_WEBHOOK_URL || THREAD_WEBHOOK_URL.includes('your-ngrok-url')

  function handleChange(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validate() {
    const { status, assigned_to, eta, custom_message } = form
    if (!status && !assigned_to && !eta && !custom_message) {
      return 'Fill in at least one field before sending.'
    }
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setError(null)
    setPhase('submitting')

    const payload = {
      ticket_id:      ticket.id,
      slack_thread_ts: ticket.slack_thread_ts || ticket.thread_ts || '',
      update_type:    form.update_type,
      assigned_to:    form.assigned_to,
      eta:            form.eta,
      status:         form.status,
      custom_message: form.custom_message,
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)

    try {
      const res = await fetch(webhookPath(THREAD_WEBHOOK_URL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`n8n returned ${res.status}${text ? ': ' + text.slice(0, 120) : ''}`)
      }

      setSentPayload(payload)
      setPhase('success')
    } catch (err) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        setError('Request timed out. The webhook did not respond within 20 seconds. Check that n8n is running and the ngrok URL is current.')
      } else if (err.message.includes('Failed to fetch')) {
        setError('Could not reach the webhook. Check that ngrok is running and VITE_N8N_THREAD_WEBHOOK_URL is up to date.')
      } else {
        setError(err.message)
      }
      setPhase('error')
    }
  }

  function handleReset() {
    setForm(DEFAULT_FORM)
    setPhase('idle')
    setError(null)
    setSentPayload(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <aside className="relative z-10 w-full max-w-lg bg-gray-900 border-l border-gray-800 overflow-y-auto scrollbar-thin shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Send Thread Update</p>
            <h2 className="text-sm font-semibold text-gray-100 truncate">{ticket.subject}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ticket context strip */}
        <div className="px-6 py-3 border-b border-gray-800/60 flex flex-wrap items-center gap-2 bg-gray-900/50">
          <UrgencyBadge urgency={ticket.urgency} />
          <CategoryBadge category={ticket.category} />
          {ticket.status && (
            <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{ticket.status}</span>
          )}
          <span className="text-xs text-gray-600 ml-auto">{ticket.email}</span>
        </div>

        <WebhookWarning />

        {/* body */}
        {phase === 'success' ? (
          <SuccessCard ticket={ticket} payload={sentPayload} onReset={handleReset} />
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 flex-1">
            {/* update type */}
            <Field label="Update Type">
              <select
                value={form.update_type}
                onChange={e => handleChange('update_type', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {UPDATE_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* status */}
            <Field label="Status" hint="Leave blank to keep unchanged">
              <select
                value={form.status}
                onChange={e => handleChange('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— unchanged —</option>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            {/* assigned to */}
            <Field label="Assign To" hint="Leave blank to keep unchanged">
              <input
                type="text"
                value={form.assigned_to}
                onChange={e => handleChange('assigned_to', e.target.value)}
                placeholder="e.g. John, devops-team"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            {/* eta */}
            <Field label="ETA" hint="Leave blank to keep unchanged">
              <input
                type="text"
                value={form.eta}
                onChange={e => handleChange('eta', e.target.value)}
                placeholder="e.g. Tomorrow 5pm, Apr 15, within 2 hours"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Field>

            {/* custom message */}
            <Field label="Custom Message" hint="Posted to the Slack thread as-is">
              <textarea
                value={form.custom_message}
                onChange={e => handleChange('custom_message', e.target.value)}
                rows={4}
                placeholder="Type a message to post in the ticket's Slack thread…"
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </Field>

            {/* validation / network error */}
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-xs leading-relaxed">
                {error}
              </div>
            )}

            {/* no slack thread warning */}
            {!ticket.slack_thread_ts && !ticket.thread_ts && (
              <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg text-yellow-400 text-xs">
                This ticket has no Slack thread timestamp. The update will still be sent, but the n8n workflow may not be able to post to a thread.
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={phase === 'submitting' || webhookUnconfigured}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
              >
                {phase === 'submitting' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <SendIcon />
                    Send Update
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-2"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</label>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SlackIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}
