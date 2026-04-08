export default function PeriodComparisonPanel({ comparison }) {
  if (!comparison) {
    return (
      <div className="card">
        <h3 className="text-base font-semibold text-white mb-4">Period Comparison</h3>
        <p className="text-sm text-slate-500">No period comparison data.</p>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-4">Period Comparison</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <p className="text-xs text-slate-500">{comparison.current?.period}</p>
          <p className="text-lg text-white font-bold">{Number(comparison.current?.total || 0).toLocaleString()} kg</p>
        </div>
        <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
          <p className="text-xs text-slate-500">{comparison.previous?.period}</p>
          <p className="text-lg text-white font-bold">{Number(comparison.previous?.total || 0).toLocaleString()} kg</p>
        </div>
      </div>
      <p className={`text-sm mt-3 ${comparison.direction === 'up' ? 'text-rose-400' : comparison.direction === 'down' ? 'text-emerald-400' : 'text-slate-400'}`}>
        {comparison.direction === 'up' ? 'Increase' : comparison.direction === 'down' ? 'Decrease' : 'No change'}: {Number(comparison.deltaPct || 0).toFixed(1)}%
      </p>
    </div>
  )
}
