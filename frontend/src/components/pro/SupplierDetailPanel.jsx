import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { api } from '../../services/api'

function formatMonthKey(key) {
  const m = String(key || '')
  const iso = m.match(/^(\d{4})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, 1)
    return d.toLocaleString(undefined, { month: 'short', year: '2-digit' })
  }
  return m
}

function formatMonthLong(key) {
  const m = String(key || '')
  const iso = m.match(/^(\d{4})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, 1)
    return d.toLocaleString(undefined, { month: 'short', year: 'numeric' })
  }
  return m
}

const SCOPE_COLORS = { scope1: '#f97316', scope2: '#3b82f6', scope3: '#a855f7' }

export default function SupplierDetailPanel({ supplierId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.getProSupplierDetail(supplierId)
        if (!ignore) setData(res)
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    if (supplierId) load()
    return () => { ignore = true }
  }, [supplierId])

  const supplier = data?.supplier
  const totals = data?.totals || {}
  const scopePct = data?.scopeContributionsPct || {}
  const categoryPct = data?.categoryContributionsPct || {}
  const mom = data?.momComparison || {}
  const trend = Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : []
  const insights = Array.isArray(data?.smartInsights) ? data.smartInsights : []
  const act = data?.latestActivity

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-slate-950 border-l border-slate-800 overflow-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider">Supplier detail</p>
            <h2 className="text-lg font-semibold text-white truncate">{supplier?.name || 'Supplier'}</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">{supplier?.email_or_phone || ''}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-10">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading supplier detail...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">{error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="card">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Total emissions</p>
                  <p className="text-2xl font-black text-white mt-1 tabular-nums">
                    {Number(totals.totalCo2Kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">kg CO₂e</p>
                </div>
                <div className="card">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">% of total</p>
                  <p className="text-2xl font-black text-brand-300 mt-1 tabular-nums">
                    {Number(data?.supplierContributionPctOfGrandTotal || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500 mt-1">contribution</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { k: 'scope1Kg', p: 'scope1', label: 'Scope 1', color: 'text-orange-400' },
                  { k: 'scope2Kg', p: 'scope2', label: 'Scope 2', color: 'text-blue-400' },
                  { k: 'scope3Kg', p: 'scope3', label: 'Scope 3', color: 'text-purple-400' },
                ].map((s) => (
                  <div key={s.k} className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                    <p className={`text-[11px] uppercase tracking-wider ${s.color}`}>{s.label}</p>
                    <p className="text-lg font-bold text-white mt-1 tabular-nums">
                      {Number(totals[s.k] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="text-xs text-slate-500 ml-1">kg</span>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                      {Number(scopePct[s.p] || 0).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>

              <div className="card mb-4">
                <h3 className="font-semibold text-white text-sm mb-2">Category contribution (%)</h3>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                    <p className="text-slate-400">Fuel</p>
                    <p className="text-white font-bold mt-1 tabular-nums">{Number(categoryPct.fuel || 0).toFixed(1)}%</p>
                  </div>
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                    <p className="text-slate-400">Electricity</p>
                    <p className="text-white font-bold mt-1 tabular-nums">{Number(categoryPct.electricity || 0).toFixed(1)}%</p>
                  </div>
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                    <p className="text-slate-400">Transport</p>
                    <p className="text-white font-bold mt-1 tabular-nums">{Number(categoryPct.transport || 0).toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="card mb-4">
                <h3 className="font-semibold text-white text-sm mb-2">Month-over-month comparison</h3>
                {mom.available ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-slate-200">{mom.message}</p>
                      <span className={`text-[11px] px-2 py-1 rounded-full border uppercase tracking-wider ${
                        mom.direction === 'increase'
                          ? 'text-red-200 border-red-800/60 bg-red-950/40'
                          : mom.direction === 'decrease'
                            ? 'text-emerald-200 border-emerald-800/60 bg-emerald-950/40'
                            : 'text-slate-300 border-slate-700 bg-slate-900/60'
                      }`}>
                        {mom.direction}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                        <p className="text-slate-500">Current ({formatMonthLong(mom.currentMonth)})</p>
                        <p className="text-white font-semibold mt-1 tabular-nums">{Number(mom.currentTotalKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
                      </div>
                      <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                        <p className="text-slate-500">Previous ({formatMonthLong(mom.previousMonth)})</p>
                        <p className="text-white font-semibold mt-1 tabular-nums">{Number(mom.previousTotalKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</p>
                      </div>
                      <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/40">
                        <p className="text-slate-500">Delta</p>
                        <p className={`font-semibold mt-1 tabular-nums ${mom.direction === 'increase' ? 'text-red-300' : mom.direction === 'decrease' ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {mom.direction === 'increase' ? '+' : mom.direction === 'decrease' ? '-' : ''}
                          {Number(Math.abs(mom.deltaPct || 0)).toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                          {mom.deltaKg > 0 ? '+' : mom.deltaKg < 0 ? '-' : ''}{Number(Math.abs(mom.deltaKg || 0)).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">{mom.message || 'Not enough data for comparison.'}</p>
                )}
              </div>

              <div className="card mb-4">
                <h3 className="font-semibold text-white text-sm mb-1">Monthly trend (this supplier)</h3>
                <p className="text-xs text-slate-500 mb-3">Detect month-over-month change</p>
                {trend.length ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={formatMonthKey} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        content={({ active, payload, label }) =>
                          active && payload?.length ? (
                            <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
                              <p className="text-slate-400">{formatMonthKey(label)}</p>
                              {payload.map((p) => (
                                <p key={p.dataKey} className="mt-1">
                                  <span className="text-slate-300">{p.name}:</span>{' '}
                                  <span className="text-white font-bold">{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
                                </p>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-slate-400">{v}</span>} />
                      <Line type="monotone" dataKey="co2" name="Total" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="scope1" name="Scope 1" stroke={SCOPE_COLORS.scope1} strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="scope2" name="Scope 2" stroke={SCOPE_COLORS.scope2} strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="scope3" name="Scope 3" stroke={SCOPE_COLORS.scope3} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[220px] flex items-center justify-center text-slate-600 text-sm">No trend history yet.</div>
                )}
              </div>

              <div className="card mb-4">
                <h3 className="font-semibold text-white text-sm mb-2">Activity data (latest)</h3>
                {act ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Electricity</span><span className="text-white tabular-nums">{Number(act.electricityKwh || 0).toLocaleString()} kWh</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Fuel</span><span className="text-white tabular-nums">{Number(act.fuelLiters || 0).toLocaleString()} L</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Transport</span><span className="text-white tabular-nums">{Number(act.transportKm || 0).toLocaleString()} km</span></div>
                    {act.created_at && <p className="text-[11px] text-slate-600 mt-2">As of {new Date(act.created_at).toLocaleString()}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No submission activity yet.</p>
                )}
              </div>

              <div className="card">
                <h3 className="font-semibold text-white text-sm mb-2">Smart insights</h3>
                {insights.length ? (
                  <ul className="space-y-2">
                    {insights.map((t, i) => (
                      <li key={i} className="border border-slate-800 rounded-xl p-3 bg-slate-900/50 text-sm text-slate-200">
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No insights yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

