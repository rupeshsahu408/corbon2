export default function ForecastPanel({ forecast }) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-4">Predictive Analysis</h3>
      <p className="text-sm text-slate-400">Next month estimate</p>
      <p className="text-3xl font-black text-brand-400 mt-1">{Number(forecast?.nextMonthEstimate || 0).toLocaleString()} kg</p>
      <p className="text-xs text-slate-500 mt-1">Confidence: {forecast?.confidence || 'low'}</p>
      <div className="mt-4 space-y-1">
        {(forecast?.history || []).slice(-4).map((item) => (
          <div key={item.month} className="flex justify-between text-xs">
            <span className="text-slate-500">{item.month}</span>
            <span className="text-slate-300">{Number(item.total || 0).toLocaleString()} kg</span>
          </div>
        ))}
      </div>
    </div>
  )
}
