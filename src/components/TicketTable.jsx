import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import UrgencyBadge from './UrgencyBadge'
import CategoryBadge from './CategoryBadge'
import ThreadUpdatePanel from './ThreadUpdatePanel'
import SuggestedResponsePanel from './SuggestedResponsePanel'

const SLACK_CHANNEL = import.meta.env.VITE_SLACK_CHANNEL_ID || 'C0APTM3L9RS'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const PAGE_SIZE = 25

function slackThreadUrl(ts) {
  if (!ts) return null
  const tsClean = ts.replace('.', '')
  return `https://wipl.slack.com/archives/${SLACK_CHANNEL}/p${tsClean}`
}

function supabaseRecordUrl(id) {
  return `${SUPABASE_URL}/project/default/editor?filter=id%3Aeq%3A${id}`
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, onReset }) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-5 py-4 border-b border-gray-800">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Category</label>
        <select
          value={filters.category}
          onChange={e => onChange('category', e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          {['Technical', 'Billing', 'Account', 'Feature Request', 'General'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Urgency</label>
        <select
          value={filters.urgency}
          onChange={e => onChange('urgency', e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          {['Critical', 'High', 'Normal', 'Low'].map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Decision</label>
        <select
          value={filters.decision}
          onChange={e => onChange('decision', e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">From</label>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={e => onChange('dateFrom', e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">To</label>
        <input
          type="date"
          value={filters.dateTo}
          onChange={e => onChange('dateTo', e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        onClick={onReset}
        className="ml-auto text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg px-3 py-1.5 hover:border-gray-500 transition-colors"
      >
        Reset filters
      </button>
    </div>
  )
}

// ── Detail side panel ─────────────────────────────────────────────────────────
function DetailPanel({ ticket, onClose }) {
  if (!ticket) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <aside className="relative z-10 w-full max-w-xl bg-gray-900 border-l border-gray-800 overflow-y-auto scrollbar-thin shadow-2xl flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-base font-semibold text-gray-100 truncate pr-4">{ticket.subject}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5 space-y-5 flex-1">
          {/* meta row */}
          <div className="flex flex-wrap gap-2">
            <UrgencyBadge urgency={ticket.urgency} />
            <CategoryBadge category={ticket.category} />
            {ticket.decision && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                ticket.decision === 'approved'
                  ? 'bg-green-500/20 text-green-400 ring-green-500/40'
                  : 'bg-red-500/20 text-red-400 ring-red-500/40'
              }`}>
                {ticket.decision}
              </span>
            )}
          </div>

          <Row label="ID" value={ticket.id} mono />
          <Row label="Email" value={ticket.email} />
          <Row label="Status" value={ticket.status} />
          <Row label="Approved by" value={ticket.approved_by || '—'} />
          <Row label="Created" value={formatDate(ticket.created_at)} />
          <Row label="RAG used" value={ticket.rag_used ? 'Yes' : 'No'} />
          {ticket.rag_used && (
            <Row label="Similarity score" value={ticket.max_similarity?.toFixed(4) ?? '—'} mono />
          )}

          {ticket.summary && (
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-sm text-gray-300 bg-gray-800/60 rounded-lg p-3 leading-relaxed">{ticket.summary}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Message</p>
            <p className="text-sm text-gray-300 bg-gray-800/60 rounded-lg p-3 leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
          </div>

          {/* action links */}
          <div className="flex gap-3 pt-2">
            {ticket.slack_thread_ts && (
              <a
                href={slackThreadUrl(ticket.slack_thread_ts)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg px-3 py-2 transition-colors"
              >
                <SlackIcon />
                View Slack thread
              </a>
            )}
            <a
              href={supabaseRecordUrl(ticket.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2 transition-colors"
            >
              <DBIcon />
              View in Supabase
            </a>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Row({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm text-gray-300 ${mono ? 'font-mono' : ''}`}>{value}</p>
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

function DBIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}

function SendUpdateIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  )
}

function SuggestionIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
const DEFAULT_FILTERS = { category: '', urgency: '', decision: '', dateFrom: '', dateTo: '' }

export default function TicketTable() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [updateTicket, setUpdateTicket] = useState(null)
  const [suggestionTicket, setSuggestionTicket] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('tickets')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: sortDir === 'asc' })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filters.category)  query = query.eq('category', filters.category)
      if (filters.urgency)   query = query.eq('urgency', filters.urgency)
      if (filters.decision)  query = query.eq('decision', filters.decision)
      if (filters.dateFrom)  query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) {
        // include the full day
        const to = new Date(filters.dateTo)
        to.setDate(to.getDate() + 1)
        query = query.lt('created_at', to.toISOString().split('T')[0])
      }

      const { data, error: sbError, count } = await query

      if (sbError) throw sbError
      setTickets(data ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters, page, sortDir])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [filters])

  function handleFilterChange(key, value) {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="flex flex-col h-full">
      {/* filter bar */}
      <FilterBar filters={filters} onChange={handleFilterChange} onReset={() => setFilters(DEFAULT_FILTERS)} />

      {/* table area */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {error && (
          <div className="m-5 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
            Failed to load tickets: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading tickets…
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            No tickets match the current filters.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-[28%]">Subject</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Urgency</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Decision</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">RAG</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Similarity</th>
                <th
                  className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 transition-colors"
                  onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
                >
                  Created {sortDir === 'desc' ? '↓' : '↑'}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {tickets.map(ticket => (
                <tr
                  key={ticket.id}
                  className="hover:bg-gray-800/40 transition-colors group"
                >
                  <td className="px-4 py-3 text-gray-200 max-w-xs">
                    <p className="truncate font-medium" title={ticket.subject}>{ticket.subject}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-[180px]">
                    <p className="truncate" title={ticket.email}>{ticket.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={ticket.category} />
                  </td>
                  <td className="px-4 py-3">
                    <UrgencyBadge urgency={ticket.urgency} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{ticket.status || '—'}</td>
                  <td className="px-4 py-3">
                    {ticket.decision ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                        ticket.decision === 'approved'
                          ? 'bg-green-500/20 text-green-400 ring-green-500/40'
                          : 'bg-red-500/20 text-red-400 ring-red-500/40'
                      }`}>
                        {ticket.decision}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {ticket.rag_used ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40">Yes</span>
                    ) : (
                      <span className="text-gray-600 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {ticket.max_similarity != null ? ticket.max_similarity.toFixed(3) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(ticket.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
                      {ticket.slack_thread_ts && (
                        <a
                          href={slackThreadUrl(ticket.slack_thread_ts)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Slack thread"
                          className="p-1.5 rounded-md hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <SlackIcon />
                        </a>
                      )}
                      <a
                        href={supabaseRecordUrl(ticket.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View in Supabase"
                        className="p-1.5 rounded-md hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-400 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <DBIcon />
                      </a>
                      <button
                        onClick={() => { setUpdateTicket(ticket); setSelectedTicket(null); setSuggestionTicket(null) }}
                        title="Send thread update"
                        className="p-1.5 rounded-md hover:bg-orange-500/20 text-gray-500 hover:text-orange-400 transition-colors"
                      >
                        <SendUpdateIcon />
                      </button>
                      <button
                        onClick={() => { setSuggestionTicket(ticket); setSelectedTicket(null); setUpdateTicket(null) }}
                        title="View suggested response"
                        className="p-1.5 rounded-md hover:bg-indigo-500/20 text-gray-500 hover:text-indigo-400 transition-colors"
                      >
                        <SuggestionIcon />
                      </button>
                      <button
                        onClick={() => { setSelectedTicket(ticket); setUpdateTicket(null); setSuggestionTicket(null) }}
                        title="View details"
                        className="p-1.5 rounded-md hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 shrink-0">
        <p className="text-xs text-gray-500">
          Showing {tickets.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} tickets
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage(p => p - 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500">Page {page + 1} / {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(p => p + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* side panels */}
      {selectedTicket && (
        <DetailPanel ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
      {updateTicket && (
        <ThreadUpdatePanel ticket={updateTicket} onClose={() => setUpdateTicket(null)} />
      )}
      {suggestionTicket && (
        <SuggestedResponsePanel ticket={suggestionTicket} onClose={() => setSuggestionTicket(null)} />
      )}
    </div>
  )
}
