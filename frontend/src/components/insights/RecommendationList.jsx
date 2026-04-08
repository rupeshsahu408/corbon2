export default function RecommendationList({ recommendations = [] }) {
  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-4">Reduction Suggestions</h3>
      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-500">No recommendations yet.</p>
        ) : recommendations.map((item) => (
          <div key={item.key} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="text-sm text-slate-300 mt-1">{item.action}</p>
            <p className="text-xs text-slate-500 mt-2">Impact: {item.impact}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
