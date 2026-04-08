export default function InsightCard({ insight }) {
  const severityClass = {
    high: 'border-rose-700/50 bg-rose-950/20',
    medium: 'border-amber-700/50 bg-amber-950/20',
    low: 'border-slate-700 bg-slate-900',
  }[insight?.severity || 'low']

  return (
    <div className={`card border ${severityClass}`}>
      <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Insight</p>
      <h3 className="text-base font-semibold text-white mb-2">{insight?.title || 'No insight'}</h3>
      <p className="text-sm text-slate-300">{insight?.detail || 'No details available.'}</p>
    </div>
  )
}
