import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

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

function StatCard({ label, value, sub }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-white mt-1 tabular-nums">
        {Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function ProDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertActioningId, setAlertActioningId] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.getProDashboard()
        if (!ignore) setData(res)
      } catch (e) {
        if (!ignore) setError(e.message || 'Failed to load')
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  const total = Number(data?.totalEmissionsKg || 0)
  const scope = data?.scopeBreakdownKg || {}
  const scopePct = data?.scopeContributionsPct || {}
  const categoryPct = data?.categoryContributionsPct || {}
  const mom = data?.momComparison || {}
  const trend = Array.isArray(data?.monthlyTrend) ? data.monthlyTrend : []
  const top = Array.isArray(data?.topSuppliers) ? data.topSuppliers : []
  const insights = Array.isArray(data?.insights) ? data.insights : []
  const alerts = Array.isArray(data?.alerts) ? data.alerts : []
  const rankings = data?.rankings || {}

  async function handleAcknowledge(id) {
    setAlertActioningId(`ack-${id}`)
    try {
      await api.acknowledgeProAlert(id)
      const refreshed = await api.getProDashboard()
      setData(refreshed)
    } catch (e) {
      setError(e.message || 'Failed to acknowledge alert')
    } finally {
      setAlertActioningId('')
    }
  }

  async function handleResolve(id) {
    setAlertActioningId(`res-${id}`)
    try {
      await api.resolveProAlert(id)
      const refreshed = await api.getProDashboard()
      setData(refreshed)
    } catch (e) {
      setError(e.message || 'Failed to resolve alert')
    } finally {
      setAlertActioningId('')
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 page-header flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">PRO Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Executive summary → breakdown → deep insights</p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pro/suppliers" className="btn-secondary">View Suppliers</Link>
          </div>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading PRO dashboard...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => window.location.reload()} className="text-red-300 hover:text-white underline text-xs">Reload</button>
            </div>
          ) : (
            <>
              <div className="card bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 mb-6">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Total emissions</p>
                <p className="text-4xl font-black text-white">
                  {total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-base font-normal text-slate-400 ml-2">kg CO₂</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">How big the problem is</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard label="Scope 1" value={scope.scope1} sub={`${Number(scopePct.scope1 || 0).toFixed(1)}%`} />
                <StatCard label="Scope 2" value={scope.scope2} sub={`${Number(scopePct.scope2 || 0).toFixed(1)}%`} />
                <StatCard label="Scope 3" value={scope.scope3} sub={`${Number(scopePct.scope3 || 0).toFixed(1)}%`} />
              </div>

              <div className="card mb-6">
                <h2 className="font-semibold text-white text-sm mb-3">Category contribution (%)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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

              <div className="card mb-6">
                <h2 className="font-semibold text-white text-sm mb-2">Month-over-month comparison</h2>
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

              <div className="card mb-6">
                <h2 className="font-semibold text-white text-sm mb-3">Advanced alerts</h2>
                {alerts.length ? (
                  <ul className="space-y-2">
                    {alerts.map((a) => {
                      const sev =
                        a.severity === 'high'
                          ? 'border-red-700/40 bg-red-950/30 text-red-200'
                          : a.severity === 'medium'
                            ? 'border-yellow-700/40 bg-yellow-950/25 text-yellow-200'
                            : 'border-emerald-700/40 bg-emerald-950/20 text-emerald-200'
                      return (
                        <li key={a.id} className={`rounded-xl border p-3 ${sev}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm">{a.message}</p>
                              <p className="text-[11px] opacity-80 mt-1 uppercase">{a.severity}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleAcknowledge(a.id)}
                                className="text-[11px] underline"
                              >
                                {alertActioningId === `ack-${a.id}` ? 'Saving...' : 'Acknowledge'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResolve(a.id)}
                                className="text-[11px] underline"
                              >
                                {alertActioningId === `res-${a.id}` ? 'Saving...' : 'Resolve'}
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No open advanced alerts.</p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="font-semibold text-white text-sm">Monthly emissions trend</h2>
                      <p className="text-xs text-slate-500 mt-0.5">Total + scope breakdown</p>
                    </div>
                  </div>
                  {trend.length ? (
                    <ResponsiveContainer width="100%" height={240}>
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
                    <div className="h-[240px] flex items-center justify-center text-slate-600 text-sm">No trend data yet.</div>
                  )}
                </div>

                <div className="card">
                  <h2 className="font-semibold text-white text-sm mb-2">Top 3 emitting suppliers</h2>
                  <p className="text-xs text-slate-500 mb-4">Where the problem is</p>
                  {top.length ? (
                    <div className="space-y-3">
                      {top.map((s) => (
                        <div key={`${s.kind}-${s.supplierId || s.supplierProfileId}`}>
                          <div className="flex justify-between text-sm">
                            <span className="text-white font-medium truncate">{s.name}</span>
                            <span className="text-slate-400 tabular-nums shrink-0 ml-2">
                              {Number(s.totalEmissionsKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                            <span>{s.kind === 'shared_supplier' ? 'Shared supplier' : 'Company supplier'}</span>
                            <span className="tabular-nums">{Number(s.contributionPctOfGrandTotal || 0).toFixed(1)}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${Math.min(Number(s.contributionPctOfGrandTotal || 0), 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center text-slate-600 text-sm">No suppliers with emissions yet.</div>
                  )}
                </div>
              </div>

              <div className="card mb-6">
                <h2 className="font-semibold text-white text-sm mb-3">Supplier leaderboard</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Top emitters</p>
                    <div className="space-y-2">
                      {(rankings.topEmitters || []).slice(0, 3).map((r) => (
                        <div key={`te-${r.supplierId}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">#{r.rank} {r.name}</span>
                          <span className="text-slate-400 tabular-nums">{Number(r.totalCo2Kg || 0).toFixed(1)} kg</span>
                        </div>
                      ))}
                      {!(rankings.topEmitters || []).length && <p className="text-xs text-slate-600">No data yet</p>}
                    </div>
                  </div>
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Best performers</p>
                    <div className="space-y-2">
                      {(rankings.bestPerformers || []).slice(0, 3).map((r) => (
                        <div key={`bp-${r.supplierId}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">#{r.rank} {r.name}</span>
                          <span className="text-slate-400 tabular-nums">Eff {Number(r.efficiencyScore || 0).toFixed(2)}</span>
                        </div>
                      ))}
                      {!(rankings.bestPerformers || []).length && <p className="text-xs text-slate-600">No data yet</p>}
                    </div>
                  </div>
                  <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Most improved</p>
                    <div className="space-y-2">
                      {(rankings.mostImproved || []).slice(0, 3).map((r) => (
                        <div key={`mi-${r.supplierId}`} className="flex items-center justify-between text-sm">
                          <span className="text-slate-200">#{r.rank} {r.name}</span>
                          <span className="text-emerald-300 tabular-nums">+{Number(r.improvementPct || 0).toFixed(1)}%</span>
                        </div>
                      ))}
                      {!(rankings.mostImproved || []).length && <p className="text-xs text-slate-600">No data yet</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card">
                  <h2 className="font-semibold text-white text-sm mb-3">Scope contribution</h2>
                  <div className="space-y-3">
                    {[
                      { key: 'scope1', label: 'Scope 1', pct: scopePct.scope1, color: 'bg-orange-500' },
                      { key: 'scope2', label: 'Scope 2', pct: scopePct.scope2, color: 'bg-blue-500' },
                      { key: 'scope3', label: 'Scope 3', pct: scopePct.scope3, color: 'bg-purple-500' },
                    ].map((r) => (
                      <div key={r.key}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="text-slate-300">{r.label}</span>
                          <span className="text-slate-500 text-xs tabular-nums">{Number(r.pct || 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${r.color} rounded-full`} style={{ width: `${Math.min(Number(r.pct || 0), 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h2 className="font-semibold text-white text-sm mb-3">Auto-generated insights</h2>
                  {insights.length ? (
                    <ul className="space-y-2">
                      {insights.map((t, i) => (
                        <li key={i} className="border border-slate-800 rounded-xl p-3 bg-slate-900/50 text-sm text-slate-200">
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500">No insights yet — add more data for richer signals.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

