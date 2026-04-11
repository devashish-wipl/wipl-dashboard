import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import UrgencyBadge from './UrgencyBadge'
import CategoryBadge from './CategoryBadge'

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || ''
const SLACK_CHANNEL = import.meta.env.VITE_SLACK_CHANNEL_ID || 'C0APTM3L9RS'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS  = 5 * 60 * 1000  // 5 minutes — pipeline requires human Slack approval
const WEBHOOK_SEND_TIMEOUT_MS = 10000   // abort fetch after 10s, treat as "sent"

const PLACEHOLDER_URL = 'your-ngrok-url'

function slackThreadUrl(ts) {
  if (!ts) return null
  return `https://wipl.slack.com/archives/${SLACK_CHANNEL}/p${ts.replace('.', '')}`
}

// ── Pipeline step indicator ───────────────────────────────────────────────────
const STEPS = [
  { id: 'send',     label: 'Sending to n8n' },
  { id: 'jina',     label: 'Generating embedding (Jina)' },
  { id: 'rag',      label: 'Hybrid RAG search' },
  { id: 'llm',      label: 'LLM classification (Groq)' },
  { id: 'slack',    label: 'Awaiting Slack approval' },
  { id: 'db',       label: 'Writing to Supabase' },
]

function PipelineSteps({ activeStep }) {
  const activeIdx = STEPS.findIndex(s => s.id === activeStep)
  return (
    <ol className="space-y-2">
      {STEPS.map((step, i) => {
        const done    = i < activeIdx
        const current = i === activeIdx
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
              ${done    ? 'bg-green-500/30 text-green-400' :
                current ? 'bg-blue-500/30 text-blue-400 ring-2 ring-blue-500/50' :
                          'bg-gray-800 text-gray-600'}`}>
              {done ? '✓' : i + 1}
            </span>
            <span className={`text-sm ${done ? 'text-gray-400 line-through' : current ? 'text-gray-100' : 'text-gray-600'}`}>
              {step.label}
              {current && (
                <span className="ml-2 inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Success card ──────────────────────────────────────────────────────────────
function SuccessCard({ ticket, onReset }) {
  const [copied, setCopied] = useState(false)

  function copyId() {
    navigator.clipboard.writeText(ticket.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-5">
      {/* banner */}
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4">
        <span className="text-2xl">✅</span>
        <div>
          <p className="text-sm font-semibold text-green-400">Ticket processed successfully</p>
          <p className="text-xs text-gray-400 mt-0.5">Classified, approved, and logged to Supabase</p>
        </div>
      </div>

      {/* ticket card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-100 leading-tight">{ticket.subject}</h3>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex gap-1.5">
              <CategoryBadge category={ticket.correct_category ?? ticket.category} />
              <UrgencyBadge urgency={ticket.correct_urgency ?? ticket.urgency} />
            </div>
            {/* show AI vs corrected if they differ */}
            {(ticket.correct_category && ticket.correct_category !== ticket.category) ||
             (ticket.correct_urgency  && ticket.correct_urgency  !== ticket.urgency) ? (
              <p className="text-[10px] text-gray-500">
                AI: {ticket.category} / {ticket.urgency} → corrected
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Email" value={ticket.email} />
          <Field label="Status" value={ticket.status || 'Open'} />
          <Field label="Decision">
            {ticket.decision ? (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                ticket.decision === 'approved'
                  ? 'bg-green-500/20 text-green-400 ring-green-500/40'
                  : 'bg-red-500/20 text-red-400 ring-red-500/40'
              }`}>
                {ticket.decision}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-700/50 text-gray-400 ring-1 ring-gray-600/40">
                Pending
              </span>
            )}
          </Field>
          <Field label="RAG used" value={ticket.rag_used ? `Yes (${ticket.max_similarity?.toFixed(4)})` : 'No'} />
        </div>

        {ticket.summary && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">AI Summary</p>
            <p className="text-sm text-gray-300 bg-gray-900/60 rounded-lg p-3 leading-relaxed">{ticket.summary}</p>
          </div>
        )}

        {/* ticket ID */}
        <div className="flex items-center gap-2 bg-gray-900/60 rounded-lg px-3 py-2">
          <span className="text-xs text-gray-500">Ticket ID:</span>
          <span className="text-xs font-mono text-gray-300 flex-1 truncate">{ticket.id}</span>
          <button
            onClick={copyId}
            className="text-xs text-gray-500 hover:text-gray-200 transition-colors shrink-0"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* actions */}
        <div className="flex gap-3 pt-1">
          {ticket.slack_thread_ts && (
            <a
              href={slackThreadUrl(ticket.slack_thread_ts)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-2 transition-colors"
            >
              View Slack thread →
            </a>
          )}
          <button
            onClick={onReset}
            className="ml-auto text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-2 transition-colors"
          >
            Submit another ticket
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-0.5">{label}</p>
      {children ?? <p className="text-sm text-gray-300">{value ?? '—'}</p>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const EMPTY_FORM = { subject: '', message: '', email: '' }

export default function SubmitTicket() {
  const [form, setForm]             = useState(EMPTY_FORM)
  const [errors, setErrors]         = useState({})
  const [phase, setPhase]           = useState('idle')     // idle | submitting | waiting | found | timeout | error
  const [pipelineStep, setPipelineStep] = useState('send')
  const [elapsed, setElapsed]       = useState(0)
  const [errorMsg, setErrorMsg]     = useState('')
  const [foundTicket, setFoundTicket] = useState(null)

  const pollRef       = useRef(null)
  const timerRef      = useRef(null)
  const submitTimeRef = useRef(null)
  const abortRef      = useRef(null)

  // cleanup on unmount
  useEffect(() => () => cleanup(), [])

  function cleanup() {
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
    abortRef.current?.abort()
  }

  function validate() {
    const e = {}
    if (!form.subject.trim())  e.subject = 'Subject is required'
    if (!form.message.trim())  e.message = 'Message is required'
    if (!form.email.trim())    e.email   = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // advance the pipeline step indicator automatically while waiting
  useEffect(() => {
    if (phase !== 'waiting') return
    const STEP_TIMINGS = { send: 0, jina: 3000, rag: 8000, llm: 14000, slack: 22000 }
    const timers = Object.entries(STEP_TIMINGS).map(([step, delay]) =>
      setTimeout(() => setPipelineStep(step), delay)
    )
    return () => timers.forEach(clearTimeout)
  }, [phase])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    if (WEBHOOK_URL.includes(PLACEHOLDER_URL) || !WEBHOOK_URL) {
      setErrorMsg('VITE_N8N_WEBHOOK_URL is not configured. Update your .env file with the live ngrok URL.')
      setPhase('error')
      return
    }

    cleanup()
    setPhase('submitting')
    setPipelineStep('send')
    setElapsed(0)
    setFoundTicket(null)

    submitTimeRef.current = new Date().toISOString()

    // ── POST to n8n webhook with 10s abort ────────────────────────────────────
    abortRef.current = new AbortController()
    const abortTimer = setTimeout(() => abortRef.current.abort(), WEBHOOK_SEND_TIMEOUT_MS)

    try {
      const res = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // ngrok free tier requires this header to bypass the browser warning page
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          subject: form.subject.trim(),
          message: form.message.trim(),
          email: form.email.trim(),
        }),
        signal: abortRef.current.signal,
      })
      clearTimeout(abortTimer)
      // Any HTTP response (200, 500, etc.) means n8n received it
      if (!res.ok && res.status !== 0) {
        // n8n sometimes returns non-200 on workflow errors — still start polling
        console.warn('Webhook responded with', res.status, '— starting poll anyway')
      }
    } catch (err) {
      clearTimeout(abortTimer)
      if (err.name === 'AbortError') {
        // Timed out waiting for response — n8n likely received it and is hanging
        // on the "send and wait" Slack node. Start polling.
        console.info('Webhook fetch timed out (expected with send-and-wait) — starting poll')
      } else {
        // Genuine network error
        setErrorMsg(`Could not reach n8n webhook: ${err.message}. Is ngrok running?`)
        setPhase('error')
        return
      }
    }

    // ── Start polling ─────────────────────────────────────────────────────────
    setPhase('waiting')

    // elapsed timer
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1
        if (next * 1000 >= POLL_TIMEOUT_MS) {
          cleanup()
          setPhase('timeout')
        }
        return next
      })
    }, 1000)

    // poll Supabase
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await supabase
          .from('tickets')
          .select('*')
          .eq('subject', form.subject.trim())
          .eq('email', form.email.trim())
          .gte('created_at', submitTimeRef.current)
          .order('created_at', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          cleanup()
          setPipelineStep('db')

          // Secondary lookup: ticket_approvals has the decision field
          // (written before tickets insert in the n8n workflow)
          const ticket = { ...data[0] }
          try {
            const { data: approvals } = await supabase
              .from('ticket_approvals')
              .select('decision, correct_category, correct_urgency, reviewed_at')
              .eq('subject', ticket.subject)
              .eq('email', ticket.email)
              .order('reviewed_at', { ascending: false })
              .limit(1)

            if (approvals && approvals.length > 0) {
              ticket.decision         = approvals[0].decision
              ticket.correct_category = approvals[0].correct_category
              ticket.correct_urgency  = approvals[0].correct_urgency
            }
          } catch (approvalErr) {
            console.warn('Could not fetch ticket_approvals:', approvalErr)
          }

          setFoundTicket(ticket)
          setPhase('found')
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, POLL_INTERVAL_MS)
  }

  function handleReset() {
    cleanup()
    setForm(EMPTY_FORM)
    setErrors({})
    setPhase('idle')
    setElapsed(0)
    setFoundTicket(null)
    setErrorMsg('')
  }

  const isWebhookConfigured = WEBHOOK_URL && !WEBHOOK_URL.includes(PLACEHOLDER_URL)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-auto scrollbar-thin">
      <div className="w-full max-w-2xl mx-auto px-6 pt-8 pb-16 space-y-6">

        {/* header */}
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Submit New Ticket</h2>
          <p className="text-xs text-gray-500 mt-1">
            Posts to the n8n RAG classifier pipeline → Slack approval → logged to Supabase
          </p>
          {!isWebhookConfigured && (
            <div className="mt-3 flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3">
              <span className="text-yellow-400 text-sm">⚠</span>
              <p className="text-xs text-yellow-300">
                <span className="font-semibold">Webhook not configured.</span> Update <code className="font-mono bg-gray-800 px-1 rounded">VITE_N8N_WEBHOOK_URL</code> in your <code className="font-mono bg-gray-800 px-1 rounded">.env</code> file with your live ngrok URL, then restart the dev server.
              </p>
            </div>
          )}
        </div>

        {/* ── IDLE / FORM ── */}
        {(phase === 'idle' || phase === 'submitting') && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Subject" error={errors.subject}>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Server completely down"
                className={inputClass(errors.subject)}
                disabled={phase === 'submitting'}
              />
            </FormField>

            <FormField label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="customer@example.com"
                className={inputClass(errors.email)}
                disabled={phase === 'submitting'}
              />
            </FormField>

            <FormField label="Message" error={errors.message}>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Describe the issue in detail…"
                rows={5}
                className={inputClass(errors.message) + ' resize-none'}
                disabled={phase === 'submitting'}
              />
            </FormField>

            <button
              type="submit"
              disabled={phase === 'submitting' || !isWebhookConfigured}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl px-5 py-3 transition-colors"
            >
              {phase === 'submitting' ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending to n8n…
                </>
              ) : 'Submit Ticket'}
            </button>
          </form>
        )}

        {/* ── WAITING ── */}
        {phase === 'waiting' && (
          <div className="space-y-6">
            {/* progress header */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-300">Pipeline running</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Polling Supabase every 3s · elapsed {formatElapsed(elapsed)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Timeout in</p>
                <p className="text-sm font-mono text-gray-300">{formatElapsed(Math.max(0, Math.floor(POLL_TIMEOUT_MS / 1000) - elapsed))}</p>
              </div>
            </div>

            {/* progress bar */}
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (elapsed / (POLL_TIMEOUT_MS / 1000)) * 100)}%` }}
              />
            </div>

            {/* steps */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-4">Pipeline stages</p>
              <PipelineSteps activeStep={pipelineStep} />
            </div>

            {/* ticket summary */}
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Submitted ticket</p>
              <p className="text-sm font-medium text-gray-200">{form.subject}</p>
              <p className="text-xs text-gray-500">{form.email}</p>
              <p className="text-xs text-gray-400 line-clamp-2">{form.message}</p>
            </div>

            {/* Slack note (shown after ~22s when we hit that step) */}
            {pipelineStep === 'slack' && (
              <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
                <span className="text-purple-400 text-base mt-0.5">💬</span>
                <div>
                  <p className="text-sm font-semibold text-purple-300">Waiting for Slack approval</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    A classification card has been posted to your Slack channel. The ticket will appear here once a team member approves or corrects it.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
            >
              Cancel and start over
            </button>
          </div>
        )}

        {/* ── FOUND ── */}
        {phase === 'found' && foundTicket && (
          <SuccessCard ticket={foundTicket} onReset={handleReset} />
        )}

        {/* ── TIMEOUT ── */}
        {phase === 'timeout' && (
          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-yellow-300">Still waiting after 5 minutes</p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                The ticket hasn't appeared in Supabase yet. This usually means it's still awaiting Slack approval. Check the <strong className="text-gray-300">Tickets</strong> tab — it will show up there once someone approves it in Slack.
              </p>
            </div>
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-1">
              <p className="text-xs text-gray-500">Submitted</p>
              <p className="text-sm text-gray-200 font-medium">{form.subject}</p>
              <p className="text-xs text-gray-500">{form.email}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // resume polling for another 5 min
                  setPhase('waiting')
                  setElapsed(0)
                  setPipelineStep('slack')
                }}
                className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg px-4 py-2 transition-colors"
              >
                Keep checking
              </button>
              <button
                onClick={handleReset}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-2 transition-colors"
              >
                Submit another ticket
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {phase === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-900/20 border border-red-700/50 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-red-400">Submission failed</p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{errorMsg}</p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg px-4 py-2 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function inputClass(hasError) {
  return `w-full bg-gray-800 border ${hasError ? 'border-red-500' : 'border-gray-700'} text-gray-200 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600 disabled:opacity-50`
}

function FormField({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 font-medium uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

function formatElapsed(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
