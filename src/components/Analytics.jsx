import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(n, total) {
  if (!total) return '—'
  return (n / total * 100).toFixed(1) + '%'
}

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

const CATEGORY_COLORS = {
  Technical:        '#a78bfa',
  Billing:          '#fbbf24',
  Account:          '#22d3ee',
  'Feature Request': '#34d399',
  General:          '#818cf8',
}

const URGENCY_COLORS = {
  Critical: '#f87171',
  High:     '#fb923c',
  Normal:   '#60a5fa',
  Low:      '#6b7280',
}

const CATEGORY_ORDER   = ['Technical', 'Billing', 'Account', 'Feature Request', 'General']
const URGENCY_ORDER    = ['Critical', 'High', 'Normal', 'Low']

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-1">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? 'text-gray-100'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? p.fill }} className="font-medium">
          {p.value} ticket{p.value !== 1 ? 's' : ''}
        </p>
      ))}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{title}</h2>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Analytics() {
  const [phase, setPhase]         = useState('loading')   // 'loading' | 'loaded' | 'error'
  const [error, setError]         = useState(null)
  const [tickets, setTickets]     = useState([])
  const [approvals, setApprovals] = useState([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setPhase('loading')
      setError(null)

      const [ticketsRes, approvalsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('id, category, urgency, rag_used, max_similarity, created_at')
          .order('created_at', { ascending: true }),
        supabase
          .from('ticket_approvals')
          .select('decision'),
      ])

      if (cancelled) return

      if (ticketsRes.error) { setError(ticketsRes.error.message); setPhase('error'); return }
      if (approvalsRes.error) { setError(approvalsRes.error.message); setPhase('error'); return }

      setTickets(ticketsRes.data ?? [])
      setApprovals(approvalsRes.data ?? [])
      setPhase('loaded')
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ── Derived metrics ──────────────────────────────────────────────────────
  const total       = tickets.length
  const ragUsed     = tickets.filter(t => t.rag_used).length
  const ragHitRate  = pct(ragUsed, total)

  const approved    = approvals.filter(a => a.decision?.toLowerCase() === 'approved').length
  const rejected    = approvals.filter(a => a.decision?.toLowerCase() === 'rejected').length
  const totalDecisions = approvals.length

  const ragTickets  = tickets.filter(t => t.rag_used && t.max_similarity != null)
  const avgSimilarity = ragTickets.length
    ? (ragTickets.reduce((s, t) => s + t.max_similarity, 0) / ragTickets.length).toFixed(4)
    : '—'

  // ── Category chart data ──────────────────────────────────────────────────
  const categoryData = CATEGORY_ORDER.map(cat => ({
    name: cat,
    count: tickets.filter(t => t.category === cat).length,
    fill: CATEGORY_COLORS[cat],
  }))

  // ── Urgency chart data ───────────────────────────────────────────────────
  const urgencyData = URGENCY_ORDER.map(u => ({
    name: u,
    count: tickets.filter(t => t.urgency === u).length,
    fill: URGENCY_COLORS[u],
  }))

  // ── Volume over time (by day) ────────────────────────────────────────────
  const dayMap = {}
  for (const t of tickets) {
    const day = t.created_at?.slice(0, 10)
    if (day) dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const volumeData = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day: fmtDay(day), count }))

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm gap-3">
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading analytics…
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="m-6 p-4 bg-red-900/30 border border-red-700 rounded-xl text-red-300 text-sm">
        Failed to load analytics: {error}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin px-6 py-6 space-y-8">

      {/* ── Metric cards ── */}
      <section className="space-y-3">
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <MetricCard
            label="Total Tickets"
            value={total}
            sub="all time"
          />
          <MetricCard
            label="Approval Rate"
            value={pct(approved, totalDecisions)}
            sub={`${approved} of ${totalDecisions} reviewed`}
            accent="text-green-400"
          />
          <MetricCard
            label="Rejection Rate"
            value={pct(rejected, totalDecisions)}
            sub={`${rejected} of ${totalDecisions} reviewed`}
            accent="text-red-400"
          />
          <MetricCard
            label="RAG Hit Rate"
            value={ragHitRate}
            sub={`${ragUsed} tickets used context`}
            accent="text-teal-400"
          />
          <MetricCard
            label="Avg Similarity"
            value={avgSimilarity}
            sub={ragTickets.length ? `across ${ragTickets.length} RAG tickets` : 'no RAG tickets'}
            accent="text-blue-400"
          />
        </div>
      </section>

      {/* ── Charts row ── */}
      <section className="space-y-3">
        <SectionHeader title="Tickets by Category" />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {total === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryData.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Tickets by Urgency" />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {total === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={urgencyData} layout="vertical" barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {urgencyData.map(entry => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader title="Ticket Volume Over Time" />
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          {volumeData.length < 2 ? (
            <EmptyChart message="Not enough data yet — need tickets across at least 2 days." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ fill: '#60a5fa', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#93c5fd' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

    </div>
  )
}

function EmptyChart({ message = 'No ticket data yet.' }) {
  return (
    <div className="flex items-center justify-center h-24 text-gray-600 text-sm">{message}</div>
  )
}
