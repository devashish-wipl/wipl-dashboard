const CATEGORY_STYLES = {
  Technical:         'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40',
  Billing:           'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/40',
  Account:           'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40',
  'Feature Request': 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40',
  General:           'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40',
}

export default function CategoryBadge({ category }) {
  const style = CATEGORY_STYLES[category] ?? 'bg-gray-700 text-gray-300'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {category ?? '—'}
    </span>
  )
}
