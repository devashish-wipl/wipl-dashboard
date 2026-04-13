import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import UrgencyBadge from './UrgencyBadge'
import CategoryBadge from './CategoryBadge'

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-400">Copied</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-gray-800/40 hover:bg-gray-800/60 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-gray-900/50">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SuggestedResponsePanel({ ticket, onClose }) {
  const [phase, setPhase] = useState('loading')   // 'loading' | 'loaded' | 'empty' | 'error'
  const [suggestion, setSuggestion] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticket?.id) {
      setPhase('empty')
      return
    }

    let cancelled = false

    async function fetchSuggestion() {
      setPhase('loading')
      setError(null)

      const { data, error: sbError } = await supabase
        .from('ticket_suggestions')
        .select('suggested_response, internal_notes, ticket_id, created_at')
        .eq('ticket_id', ticket.id)
        .maybeSingle()

      if (cancelled) return

      if (sbError) {
        setError(sbError.message)
        setPhase('error')
        return
      }

      if (!data) {
        setPhase('empty')
        return
      }

      setSuggestion(data)
      setPhase('loaded')
    }

    fetchSuggestion()
    return () => { cancelled = true }
  }, [ticket?.id])

  if (!ticket) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <aside className="relative z-10 w-full max-w-lg bg-gray-900 border-l border-gray-800 overflow-y-auto scrollbar-thin shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="min-w-0 pr-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Suggested Response</p>
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

        {/* body */}
        <div className="px-6 py-5 flex-1">
          {phase === 'loading' && (
            <div className="flex items-center gap-3 text-gray-500 text-sm py-8">
              <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading suggestion…
            </div>
          )}

          {phase === 'error' && (
            <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-xl text-red-300 text-sm">
              Failed to load suggestion: {error}
            </div>
          )}

          {phase === 'empty' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-400">No suggestion generated</p>
              <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                The LLM suggestion for this ticket either hasn't been generated yet or the ticket ID hasn't been backfilled by n8n.
              </p>
            </div>
          )}

          {phase === 'loaded' && suggestion && (
            <div className="space-y-4">
              {/* suggested response */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Suggested Response</p>
                  {suggestion.suggested_response && (
                    <CopyButton text={suggestion.suggested_response} />
                  )}
                </div>
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {suggestion.suggested_response || <span className="text-gray-600 italic">No response text.</span>}
                  </p>
                </div>
              </div>

              {/* internal notes — collapsible */}
              <Collapsible title="Internal Notes" defaultOpen={false}>
                {suggestion.internal_notes ? (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{suggestion.internal_notes}</p>
                ) : (
                  <p className="text-sm text-gray-600 italic">No internal notes.</p>
                )}
              </Collapsible>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
