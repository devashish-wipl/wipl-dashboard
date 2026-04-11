const URGENCY_STYLES = {
  Critical: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40',
  High:     'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40',
  Normal:   'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/40',
  Low:      'bg-gray-500/20 text-gray-400 ring-1 ring-gray-500/40',
}

export default function UrgencyBadge({ urgency }) {
  const style = URGENCY_STYLES[urgency] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {urgency ?? '—'}
    </span>
  )
}
