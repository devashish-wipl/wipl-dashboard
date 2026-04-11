import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const PAGE_SIZE = 25

// ── Table definitions ─────────────────────────────────────────────────────────
const TABLES = {
  resolved_tickets: {
    label: 'resolved_tickets',
    description: 'Tickets resolved or corrected via the Slack approval flow',
    orderBy: 'created_at',
    searchColumn: 'subject',
    // exclude embedding vector
    selectClause: 'id, subject, message, category, urgency, resolution, created_at',
    columns: [
      { key: 'id',         label: 'ID',         mono: true, truncate: true, maxW: 'max-w-[140px]' },
      { key: 'subject',    label: 'Subject',    truncate: true, maxW: 'max-w-[200px]' },
      { key: 'category',   label: 'Category',   badge: 'category' },
      { key: 'urgency',    label: 'Urgency',    badge: 'urgency' },
      { key: 'resolution', label: 'Resolution', truncate: true, maxW: 'max-w-[260px]' },
      { key: 'created_at', label: 'Created',    date: true },
    ],
  },
  ticket_approvals: {
    label: 'ticket_approvals',
    description: 'Human review decisions from the Slack approval modal',
    orderBy: 'reviewed_at',
    searchColumn: 'subject',
    selectClause: '*',
    columns: [
      { key: 'id',                 label: 'ID',            mono: true },
      { key: 'subject',            label: 'Subject',       truncate: true, maxW: 'max-w-[180px]' },
      { key: 'email',              label: 'Email',         truncate: true, maxW: 'max-w-[150px]' },
      { key: 'suggested_category', label: 'AI Category',   badge: 'category' },
      { key: 'suggested_urgency',  label: 'AI Urgency',    badge: 'urgency' },
      { key: 'correct_category',   label: 'Final Category',badge: 'category' },
      { key: 'correct_urgency',    label: 'Final Urgency', badge: 'urgency' },
      { key: 'decision',           label: 'Decision',      badge: 'decision' },
      { key: 'rag_used',           label: 'RAG',           boolean: true },
      { key: 'max_similarity',     label: 'Similarity',    mono: true, format: v => v != null ? Number(v).toFixed(4) : '—' },
      { key: 'reviewed_at',        label: 'Reviewed',      date: true },
    ],
  },
  ticket_suggestions: {
    label: 'ticket_suggestions',
    description: 'LLM-generated customer responses and internal notes per ticket',
    orderBy: 'created_at',
    searchColumn: 'subject',
    selectClause: '*',
    columns: [
      { key: 'id',                label: 'ID',               mono: true, truncate: true, maxW: 'max-w-[80px]' },
      { key: 'ticket_id',         label: 'Ticket ID',        mono: true, truncate: true, maxW: 'max-w-[80px]' },
      { key: 'subject',           label: 'Subject',          truncate: true, maxW: 'max-w-[180px]' },
      { key: 'email',             label: 'Email',            truncate: true, maxW: 'max-w-[150px]' },
      { key: 'suggested_response',label: 'Suggested Response',truncate: true, maxW: 'max-w-[280px]' },
      { key: 'internal_notes',    label: 'Internal Notes',   truncate: true, maxW: 'max-w-[200px]' },
      { key: 'created_at',        label: 'Created',          date: true },
    ],
  },
}

// ── Badge / cell helpers ──────────────────────────────────────────────────────
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

function renderCell(col, value) {
  if (value === null || value === undefined) {
    return <span className="text-gray-600 text-xs">—</span>
  }

  if (col.date) {
    return (
      <span className="text-gray-500 text-xs whitespace-nowrap">
        {new Date(value).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', hour12: true,
        })}
      </span>
    )
  }

  if (col.boolean) {
    return value
      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-400 ring-1 ring-teal-500/40">Yes</span>
      : <span className="text-gray-600 text-xs">No</span>
  }

  if (col.badge === 'urgency') {
    const s = URGENCY_STYLES[value] ?? 'bg-gray-700/40 text-gray-400'
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s}`}>{value}</span>
  }

  if (col.badge === 'category') {
    const s = CATEGORY_STYLES[value] ?? 'bg-gray-700/40 text-gray-400'
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s}`}>{value}</span>
  }

  if (col.badge === 'decision') {
    const approved = String(value).toLowerCase() === 'approved'
    const s = approved
      ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
      : 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s}`}>{value}</span>
  }

  if (col.format) {
    return <span className="font-mono text-xs text-gray-300">{col.format(value)}</span>
  }

  const display = String(value)

  if (col.truncate) {
    return (
      <span className={`block truncate ${col.maxW ?? ''}`} title={display}>
        {col.mono
          ? <span className="font-mono text-xs text-gray-300">{display}</span>
          : <span className="text-sm text-gray-300">{display}</span>
        }
      </span>
    )
  }

  return col.mono
    ? <span className="font-mono text-xs text-gray-300">{display}</span>
    : <span className="text-sm text-gray-300">{display}</span>
}

// ── Row detail modal ──────────────────────────────────────────────────────────
function RowModal({ row, tableDef, onClose }) {
  if (!row) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div>
            <p className="text-xs text-gray-500 font-mono mb-0.5">{tableDef.label}</p>
            <h3 className="text-sm font-semibold text-gray-100 truncate max-w-lg">
              {row.subject ?? row.id ?? 'Row detail'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200 transition-colors shrink-0 ml-4">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* body — show ALL fields including long text */}
        <div className="overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
          {tableDef.columns.map(col => {
            const val = row[col.key]
            const display = val === null || val === undefined ? null : String(val)
            return (
              <div key={col.key}>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{col.label}</p>
                {display == null ? (
                  <p className="text-xs text-gray-600 italic">null</p>
                ) : (
                  <div className="bg-gray-800/60 rounded-lg px-3 py-2">
                    {col.date ? (
                      <p className="text-sm text-gray-300">
                        {new Date(val).toLocaleString('en-IN', {
                          weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
                        })}
                      </p>
                    ) : col.badge || col.boolean ? (
                      <div>{renderCell(col, val)}</div>
                    ) : (
                      <p className="text-sm text-gray-300 whitespace-pre-wrap break-words font-mono leading-relaxed">{display}</p>
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
export default function DatabaseBrowser() {
  const [activeTable, setActiveTable] = useState('resolved_tickets')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  // reset page on table/search change
  useEffect(() => { setPage(0) }, [activeTable, debouncedSearch])

  const tableDef = TABLES[activeTable]

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from(activeTable)
        .select(tableDef.selectClause, { count: 'exact' })
        .order(tableDef.orderBy, { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (debouncedSearch && tableDef.searchColumn) {
        query = query.ilike(tableDef.searchColumn, `%${debouncedSearch}%`)
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
  }, [activeTable, page, debouncedSearch, tableDef])

  useEffect(() => { fetchRows() }, [fetchRows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="flex flex-col h-full">
      {/* Table tabs */}
      <div className="px-5 pt-4 border-b border-gray-800">
        <div className="flex gap-1 flex-wrap">
          {Object.entries(TABLES).map(([key, def]) => (
            <button
              key={key}
              onClick={() => { setActiveTable(key); setSearch('') }}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-mono font-medium border-b-2 transition-colors ${
                activeTable === key
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {def.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + meta */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-800">
        <p className="text-xs text-gray-500 hidden sm:block shrink-0">{tableDef.description}</p>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              placeholder={`Search by ${tableDef.searchColumn}…`}
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

      {/* Table body */}
      <div className="flex-1 overflow-auto scrollbar-thin">
        {error && (
          <div className="m-5 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
            Error loading <span className="font-mono">{activeTable}</span>: {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm gap-3">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading {activeTable}…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            No rows found{debouncedSearch ? ` for "${debouncedSearch}"` : ''}.
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
              <tr>
                {tableDef.columns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
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
                  {tableDef.columns.map(col => (
                    <td key={col.key} className="px-4 py-2.5">
                      {renderCell(col, row[col.key])}
                    </td>
                  ))}
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

      {/* Row detail modal */}
      {selectedRow && (
        <RowModal
          row={selectedRow}
          tableDef={tableDef}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </div>
  )
}
