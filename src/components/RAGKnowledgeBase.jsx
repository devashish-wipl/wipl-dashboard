import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 25
const SELECT = 'id, subject, message, category, urgency, resolution, combined_score, created_at'

const URGENCY_STYLES = {
  Critical: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40',
  High:     'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40',
  Normal:   'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40',
  Low:      'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/40',
}
const CATEGORY_STYLES = {
  Technical:         'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40',
  Billing:           'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40',
  Account:           'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40',
  'Feature Request': 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40',
  General:           'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40',
}

function ScoreBadge({ value }) {
  if (value == null) return <span className="text-gray-600 text-xs">—</span>
  const n = Number(value)
  const display = n.toFixed(4)
  let style
  if (n >= 0.5)      style = 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
  else if (n >= 0.1) style = 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40'
  else               style = 'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/40'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-medium ${style}`}>
      {display}
    </span>
  )
}

// ── Row detail modal ──────────────────────────────────────────────────────────
function RowModal({ row, onClose }) {
  if (!row) return null

  const fields = [
    { label: 'ID',             key: 'id',            mono: true },
    { label: 'Subject',        key: 'subject' },
    { label: 'Category',       key: 'category',      badge: 'category' },
    { label: 'Urgency',        key: 'urgency',        badge: 'urgency' },
    { label: 'Combined Score', key: 'combined_score', score: true },
    { label: 'Resolution',     key: 'resolution' },
    { label: 'Message',        key: 'message' },
    { label: 'Created',        key: 'created_at',    date: true },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <p className="text-xs text-gray-500 font-mono mb-0.5">resolved_tickets</p>
            <h3 className="text-sm font-semibold text-gray-100 truncate max-w-lg">
              {row.subject ?? row.id}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
          {fields.map(f => {
            const val = row[f.key]
            const isEmpty = val === null || val === undefined
            return (
              <div key={f.key}>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{f.label}</p>
                {isEmpty ? (
                  <p className="text-xs text-gray-600 italic">null</p>
                ) : (
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                    {f.date ? (
                      <p className="text-sm text-gray-300">
                        {new Date(val).toLocaleString('en-IN', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                        })}
                      </p>
                    ) : f.score ? (
                      <ScoreBadge value={val} />
                    ) : f.badge === 'category' ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[val] ?? 'bg-gray-700/40 text-gray-400'}`}>{val}</span>
                    ) : f.badge === 'urgency' ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[val] ?? 'bg-gray-700/40 text-gray-400'}`}>{val}</span>
                    ) : (
                      <p className={`text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed ${f.mono ? 'font-mono' : ''}`}>{String(val)}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RAGKnowledgeBase() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('combined_score')
  const [selectedRow, setSelectedRow] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(0) }, [debouncedSearch, sortBy])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('resolved_tickets')
        .select(SELECT, { count: 'exact' })
        .order(sortBy, { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (debouncedSearch) {
        query = query.ilike('subject', `%${debouncedSearch}%`)
      }

      const { data, error: sbError, count } = await query
      if (sbError) throw sbError
      setRows(data ?? [])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, sortBy])

  useEffect(() => { fetchRows() }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const SortButton = ({ field, label }) => (
    <button
      onClick={() => setSortBy(field)}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
        sortBy === field
          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
          : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <p className="text-xs text-gray-500">Sort:</p>
          <SortButton field="combined_score" label="Score" />
          <SortButton field="created_at" label="Date" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {totalCount > 0 && (
            <span className="text-xs text-gray-600 shrink-0">
              {totalCount} entries in vector store
            </span>
          )}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by subject…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-600"
            />
          </div>
          <button
            onClick={fetchRows}
            title="Refresh"
            className="p-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {error && (
          <div className="m-5 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
            Error loading resolved_tickets: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading knowledge base…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            No entries found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Urgency</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Resolution</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Score</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {rows.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="hover:bg-gray-800/40 transition-colors group cursor-pointer"
                  onClick={() => setSelectedRow(row)}
                >
                  <td className="px-4 py-2.5">
                    <span className="block truncate max-w-[220px] text-sm text-gray-300" title={row.subject}>
                      {row.subject ?? <span className="text-gray-600 text-xs">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.category
                      ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[row.category] ?? 'bg-gray-700/40 text-gray-400'}`}>{row.category}</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.urgency
                      ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[row.urgency] ?? 'bg-gray-700/40 text-gray-400'}`}>{row.urgency}</span>
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block truncate max-w-[280px] text-sm text-gray-300" title={row.resolution}>
                      {row.resolution ?? <span className="text-gray-600 text-xs">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <ScoreBadge value={row.combined_score} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="opacity-0 group-hover:opacity-100 text-gray-500 transition-opacity">
                      <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 shrink-0">
        <p className="text-xs text-gray-500">
          {rows.length === 0
            ? '0 rows'
            : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalCount)} of ${totalCount} rows`}
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

      {selectedRow && (
        <RowModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  )
}
