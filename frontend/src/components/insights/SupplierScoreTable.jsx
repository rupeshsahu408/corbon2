export default function SupplierScoreTable({ scores = [] }) {
  const normalized = scores.map((row) => {
    const factors = row.factors || row.factors_json || {}
    return {
      id: row.supplierId || row.supplier_id,
      name: row.name,
      score: Number(row.score || 0),
      tier: row.tier,
      completeness: factors.completeness,
      dataQuality: factors.data_quality,
      scope3Share: factors.scope3_share,
    }
  })

  return (
    <div className="card">
      <h3 className="text-base font-semibold text-white mb-4">Supplier Scoring</h3>
      {normalized.length === 0 ? (
        <p className="text-sm text-slate-500">No suppliers scored yet.</p>
      ) : (
        <div className="space-y-2">
          {normalized.slice(0, 8).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-b-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{row.name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      row.tier === 'high-risk'
                        ? 'bg-rose-950/40 border-rose-700/50 text-rose-300'
                        : row.tier === 'watch'
                          ? 'bg-amber-950/30 border-amber-700/40 text-amber-200'
                          : 'bg-emerald-950/30 border-emerald-700/40 text-emerald-200'
                    }`}
                  >
                    {row.tier || 'unclassified'}
                  </span>
                  {row.completeness != null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-300">
                      completeness {Math.round(row.completeness * 100)}%
                    </span>
                  )}
                  {row.scope3Share != null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-purple-700/50 text-purple-200">
                      {row.scope3Share.toFixed(1)}% of Scope 3
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm font-bold text-brand-400 ml-3 shrink-0 tabular-nums">
                {row.score.toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
