import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  PieChart,
  Pie,
} from 'recharts'
import Sidebar from '../components/Sidebar'
import NetworkGraphCanvas from '../components/NetworkGraphCanvas'
import { api } from '../services/api'

const SCOPE_COLORS = { scope1: '#f97316', scope2: '#3b82f6', scope3: '#a855f7' }
const SOURCE_PIE_COLORS = { fuel: '#f97316', electricity: '#3b82f6', transport: '#a855f7' }

function formatMonthKey(key) {
  // Accepts YYYY-MM (backend) or legacy "Mon YYYY"
  const m = String(key || '')
  const iso = m.match(/^(\d{4})-(\d{2})$/)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, 1)
    return d.toLocaleString(undefined, { month: 'short', year: '2-digit' })
  }
  return m
}

function ScopeCard({ scope, label, value, color, desc }) {
  const colors = {
    orange: 'bg-orange-600/10 border-orange-600/20 text-orange-400',
    blue:   'bg-blue-600/10   border-blue-600/20   text-blue-400',
    purple: 'bg-purple-600/10 border-purple-600/20 text-purple-400',
    green:  'bg-brand-600/10  border-brand-600/20  text-brand-400',
  }
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${colors[color]}`}>{scope}</span>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-black text-white">{Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
      <p className="text-xs text-slate-600 mt-1">kg CO₂ — {desc}</p>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs shadow-xl space-y-1">
        <p className="text-slate-400 font-medium mb-2">{formatMonthKey(label)}</p>
        {payload.map(p => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
            <span className="text-slate-300">{p.name}:</span>
            <span className="text-white font-bold">{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const PieTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const p = payload[0]
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-300 font-medium">{p.name}</p>
        <p className="text-white font-bold mt-1">
          {Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂e
        </p>
        {p.payload?.share != null && (
          <p className="text-slate-500 mt-0.5">{Number(p.payload.share).toFixed(1)}% of chart total</p>
        )}
      </div>
    )
  }
  return null
}

function formatInrShort(n) {
  if (n == null || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n))
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [intelligence, setIntelligence] = useState(null)
  const [network, setNetwork] = useState(null)
  const [moneyLayer, setMoneyLayer] = useState(null)
  const [openAlerts, setOpenAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [trendChartMode, setTrendChartMode] = useState('bar')

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [s, a, i, n, m, alerts] = await Promise.all([
        api.getDashboardStats(),
        api.getAnalytics(),
        api.getIntelligenceOverview().catch(() => null),
        api.getCompanyNetwork().catch(() => null),
        api.getMoneyOverview().catch(() => null),
        api.getIntelligenceAlerts('open').catch(() => []),
      ])
      setStats(s)
      setAnalytics(a)
      setIntelligence(i)
      setNetwork(n)
      setMoneyLayer(m)
      setOpenAlerts(Array.isArray(alerts) ? alerts : [])
      setLastUpdated(new Date())
      setError('')
    } catch (err) {
      if (!silent) setError(err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  async function handleAcknowledgeAlert(id) {
    try {
      await api.acknowledgeIntelligenceAlert(id)
      await fetchData(true)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(true), 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  const completionPct = stats
    ? Math.round((Number(stats.completed) / Math.max(Number(stats.total), 1)) * 100)
    : 0

  const trendData  = analytics?.monthlyTrend?.length > 0 ? analytics.monthlyTrend : null
  const qualityFlags = analytics?.qualityFlags || []
  const hasScope1 = (stats?.scope1Co2 || 0) > 0
  const hasScope2 = (stats?.scope2Co2 || 0) > 0
  const hasScope3 = (stats?.scope3Co2 || 0) > 0

  if (!stats?.hasDirectData && !loading) {
    if (!qualityFlags.find(f => f.message?.includes('direct'))) {
      qualityFlags.push({ type: 'info', message: 'No direct company emissions recorded — add Scope 1/2 data in Data Entry' })
    }
  }

  const grand = Number(stats?.grandTotal || stats?.totalCo2 || 0)
  const scopePieData = [
    { name: 'Scope 1', value: Number(stats?.scope1Co2 || 0), fill: SCOPE_COLORS.scope1, share: grand > 0 ? (Number(stats?.scope1Co2 || 0) / grand) * 100 : 0 },
    { name: 'Scope 2', value: Number(stats?.scope2Co2 || 0), fill: SCOPE_COLORS.scope2, share: grand > 0 ? (Number(stats?.scope2Co2 || 0) / grand) * 100 : 0 },
    { name: 'Scope 3', value: Number(stats?.scope3Co2 || 0), fill: SCOPE_COLORS.scope3, share: grand > 0 ? (Number(stats?.scope3Co2 || 0) / grand) * 100 : 0 },
  ].filter((d) => d.value > 0)

  const co2Sources = analytics?.sourceBreakdownCo2 || []
  const sourcePieData = co2Sources
    .filter((r) => Number(r.value) > 0)
    .map((r) => ({
      name: r.label,
      value: Number(r.value),
      fill: SOURCE_PIE_COLORS[r.key] || '#64748b',
      share: Number(r.share || 0),
      key: r.key,
    }))

  const scope3TotalForHotspots = Number(stats?.scope3Co2 || 0)
  const scope3Hotspots =
    analytics?.topEmitters && scope3TotalForHotspots > 0
      ? analytics.topEmitters
          .filter((e) => Number(e.scope3_co2 || 0) > 0)
          .map((e) => {
            const v = Number(e.scope3_co2 || 0)
            const share = (v / scope3TotalForHotspots) * 100
            return {
              name: e.name,
              scope3: v,
              share: Number(share.toFixed(1)),
            }
          })
          .slice(0, 5)
      : []

  const severityRank = { critical: 0, error: 1, warning: 2, high: 2, medium: 3, low: 4, info: 5 }
  const digestItems = [
    ...openAlerts.map((a) => ({
      kind: 'alert',
      severity: a.severity || 'warning',
      message: a.message,
      id: a.id,
      sub: a.type,
    })),
    ...qualityFlags.map((f, i) => ({
      kind: 'quality',
      severity: f.type === 'error' ? 'error' : f.type === 'warning' ? 'warning' : 'info',
      message: f.message,
      id: `qf-${i}`,
      sub: 'data quality',
    })),
  ]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9))
    .slice(0, 8)

  const digestStyles = {
    critical: 'border-rose-800/50 bg-rose-950/30 text-rose-200',
    error: 'border-red-800/50 bg-red-950/30 text-red-200',
    warning: 'border-yellow-800/40 bg-yellow-950/25 text-yellow-200',
    high: 'border-rose-800/50 bg-rose-950/30 text-rose-200',
    medium: 'border-amber-800/40 bg-amber-950/20 text-amber-200',
    low: 'border-slate-700 bg-slate-900/60 text-slate-300',
    info: 'border-slate-700 bg-slate-900/60 text-slate-300',
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 page-header flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">Scope 1, 2 &amp; 3 emissions overview</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-slate-600">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading dashboard...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => fetchData()} className="text-red-300 hover:text-white underline text-xs">Retry</button>
            </div>
          ) : (
            <>
              {intelligence?.alerts?.some((a) => a.severity === 'critical') && (
                <div className="p-4 bg-rose-950/50 border border-rose-800/50 rounded-xl text-rose-300 text-sm mb-4 flex items-center justify-between">
                  <span>{intelligence.alerts.find((a) => a.severity === 'critical')?.message}</span>
                  <Link to="/insights" className="text-rose-200 hover:text-white underline text-xs">Open Insights</Link>
                </div>
              )}

              {moneyLayer && (
                <Link
                  to="/financial-impact"
                  className="block p-4 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-800/30 rounded-xl mb-6 hover:border-emerald-600/40 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-emerald-400/90 uppercase tracking-wider font-semibold">Phase C · Financial impact</p>
                      <p className="text-xl font-black text-white mt-1 tabular-nums">
                        {formatInrShort(moneyLayer.estimatedCarbonCostInr)}
                        <span className="text-sm font-normal text-slate-500 ml-2">est. carbon cost</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Overall risk:{' '}
                        <span className={moneyLayer.risks?.overall?.level === 'high' ? 'text-red-400' : moneyLayer.risks?.overall?.level === 'medium' ? 'text-yellow-400' : 'text-emerald-400'}>
                          {moneyLayer.risks?.overall?.level || 'low'}
                        </span>
                        {' '}· CBAM / BRSR signals on detail page
                      </p>
                    </div>
                    <span className="text-emerald-400 text-sm font-medium">Open money &amp; risk →</span>
                  </div>
                </Link>
              )}

              <div className="card mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-semibold text-white text-sm">Insights &amp; priorities</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Deterministic signals plus open alerts and data-quality flags</p>
                  </div>
                  <Link to="/insights" className="text-brand-400 hover:text-brand-300 text-xs font-medium">Open Insights →</Link>
                </div>
                {intelligence?.insights?.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {intelligence.insights.slice(0, 4).map((insight) => (
                      <div key={insight.key} className="border border-slate-800 rounded-xl p-3 bg-slate-900/50">
                        <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Insight</p>
                        <p className="text-sm font-semibold text-white">{insight.title}</p>
                        <p className="text-xs text-slate-400 mt-1">{insight.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">Active issues</p>
                {digestItems.length === 0 ? (
                  <p className="text-sm text-slate-500">No open alerts or flags — you&apos;re in good shape.</p>
                ) : (
                  <ul className="space-y-2">
                    {digestItems.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}`}
                        className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${digestStyles[item.severity] || digestStyles.info}`}
                      >
                        <div>
                          <p>{item.message}</p>
                          {item.sub && <p className="text-[10px] opacity-70 mt-0.5">{item.sub}</p>}
                        </div>
                        {item.kind === 'alert' && item.id && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledgeAlert(item.id)}
                            className="shrink-0 text-[11px] underline opacity-90 hover:opacity-100"
                          >
                            Acknowledge
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Grand total banner */}
              <div className="card bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Total Carbon Footprint (All Scopes)</p>
                  <p className="text-4xl font-black text-white">
                    {Number(stats?.grandTotal || stats?.totalCo2 || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                    <span className="text-base font-normal text-slate-400 ml-2">kg CO₂</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    = {((Number(stats?.grandTotal || stats?.totalCo2 || 0)) / 1000).toFixed(3)} tonnes CO₂e
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">Completion rate</p>
                  <p className="text-2xl font-bold text-brand-400">{completionPct}%</p>
                  <p className="text-xs text-slate-500">{stats?.completed} / {stats?.total} suppliers</p>
                </div>
              </div>

              {/* Scope breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <ScopeCard scope="Scope 1" label="Direct" color="orange"
                  value={stats?.scope1Co2} desc="Fuel combustion + on-site sources" />
                <ScopeCard scope="Scope 2" label="Indirect" color="blue"
                  value={stats?.scope2Co2} desc="Purchased electricity" />
                <ScopeCard scope="Scope 3" label="Supply chain" color="purple"
                  value={stats?.scope3Co2} desc="Supplier emissions + transport" />
              </div>

              {(scopePieData.length > 0 || sourcePieData.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="card">
                    <h2 className="font-semibold text-white mb-1 text-sm">Emissions by scope</h2>
                    <p className="text-xs text-slate-500 mb-3">Share of total inventory (kg CO₂e)</p>
                    {scopePieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={scopePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {scopePieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-slate-400">{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[240px] flex items-center justify-center text-slate-600 text-sm">No scope totals yet.</div>
                    )}
                  </div>
                  <div className="card">
                    <h2 className="font-semibold text-white mb-1 text-sm">Emissions by source</h2>
                    <p className="text-xs text-slate-500 mb-3">kg CO₂e from activity buckets (fuel · electricity · transport)</p>
                    {sourcePieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <PieChart>
                          <Pie
                            data={sourcePieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={58}
                            outerRadius={88}
                            paddingAngle={2}
                            stroke="none"
                          >
                            {sourcePieData.map((entry) => (
                              <Cell key={entry.key || entry.name} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<PieTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-slate-400">{v}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[240px] flex items-center justify-center text-slate-600 text-sm">No source CO₂ data yet.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Supplier stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Suppliers', value: stats?.total ?? 0, color: 'text-slate-300' },
                  { label: 'Submitted', value: stats?.completed ?? 0, color: 'text-brand-400' },
                  { label: 'Pending', value: stats?.pending ?? 0, color: 'text-yellow-400' },
                  { label: 'Overdue', value: stats?.overdue ?? 0, color: 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="card text-center py-4">
                    <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>

              {intelligence?.supplierScores?.length > 0 && (
                <div className="card mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-white text-sm">Supplier Risk Snapshot</h2>
                    <Link to="/insights" className="text-brand-400 text-xs hover:text-brand-300">Details</Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['best', 'watch', 'high-risk'].map((tier) => {
                      const count = intelligence.supplierScores.filter((s) => s.tier === tier).length
                      return (
                        <div key={tier} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                          <p className="text-xs text-slate-500 uppercase">{tier}</p>
                          <p className="text-xl font-bold text-white mt-1">{count}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {network && (
                <div className="card mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-white text-sm">Shared Supplier Network</h2>
                    <span className="text-xs text-slate-500">{network.summary?.sharedSupplierCount || 0} shared suppliers</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500">Shared suppliers</p>
                      <p className="text-2xl font-bold text-white mt-1">{network.summary?.sharedSupplierCount || 0}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500">Risk suppliers</p>
                      <p className="text-2xl font-bold text-rose-400 mt-1">{network.summary?.highRiskCount || 0}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                      <p className="text-xs text-slate-500">Edges</p>
                      <p className="text-2xl font-bold text-brand-400 mt-1">{network.graph?.edges?.length || 0}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <NetworkGraphCanvas graph={network.graph} />
                    <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                      <p className="text-xs text-slate-500 mb-2">High-risk suppliers</p>
                      <div className="space-y-2">
                        {(network.riskSuppliers || []).slice(0, 5).map((s) => (
                          <div key={s.supplier_profile_id} className="flex justify-between text-xs">
                            <span className="text-slate-200">{s.name}</span>
                            <span className="text-rose-400">Score {Number(s.emission_score || 0).toFixed(1)}</span>
                          </div>
                        ))}
                        {!(network.riskSuppliers || []).length && <p className="text-xs text-slate-500">No risk suppliers currently.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              <div className="card mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-white text-sm">Supplier Data Collection</h2>
                  <span className="text-brand-400 font-bold text-sm">{completionPct}%</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-brand-600 to-emerald-400 rounded-full transition-all duration-700" style={{ width: `${completionPct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Stacked scope trend */}
                <div className="card">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="font-semibold text-white">Monthly Emissions</h2>
                    {trendData && (
                      <div className="flex rounded-lg border border-slate-700 p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setTrendChartMode('bar')}
                          className={`px-2.5 py-1 rounded-md ${trendChartMode === 'bar' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          By scope
                        </button>
                        <button
                          type="button"
                          onClick={() => setTrendChartMode('line')}
                          className={`px-2.5 py-1 rounded-md ${trendChartMode === 'line' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Total trend
                        </button>
                      </div>
                    )}
                  </div>
                  {trendData ? (
                    trendChartMode === 'bar' ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis
                            dataKey="month"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatMonthKey}
                          />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                            formatter={(v) => <span className="text-slate-400">{v === 'scope1' ? 'Scope 1' : v === 'scope2' ? 'Scope 2' : 'Scope 3'}</span>} />
                          <Bar dataKey="scope1" name="scope1" stackId="a" fill={SCOPE_COLORS.scope1} radius={[0,0,0,0]} />
                          <Bar dataKey="scope2" name="scope2" stackId="a" fill={SCOPE_COLORS.scope2} radius={[0,0,0,0]} />
                          <Bar dataKey="scope3" name="scope3" stackId="a" fill={SCOPE_COLORS.scope3} radius={[6,6,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <XAxis
                            dataKey="month"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={formatMonthKey}
                          />
                          <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            content={({ active, payload, label }) =>
                              active && payload?.length ? (
                                <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs">
                                  <p className="text-slate-400">{formatMonthKey(label)}</p>
                                  <p className="text-white font-bold mt-1">
                                    {Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂e
                                  </p>
                                </div>
                              ) : null
                            }
                          />
                          <Line type="monotone" dataKey="co2" name="Total" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                      No emissions data yet — data appears after suppliers submit.
                    </div>
                  )}
                </div>

                {/* Top emitters */}
                <div className="card">
                  <h2 className="font-semibold text-white mb-4">Top Emitting Suppliers</h2>
                  {analytics?.topEmitters?.length > 0 ? (
                    <div className="space-y-3">
                      {analytics.topEmitters.slice(0, 5).map((e, i) => {
                        const maxCo2 = analytics.topEmitters[0]?.total_co2 || 1
                        const pct = Math.round((e.total_co2 / maxCo2) * 100)
                        const colors = ['bg-brand-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500']
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-white font-medium truncate">{e.name}</span>
                              <span className="text-slate-400 shrink-0 ml-2 tabular-nums">
                                {Number(e.total_co2).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full ${colors[i]} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      {parseFloat(analytics?.avgCo2) > 0 && (
                        <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
                          Avg per supplier:{' '}
                          <span className="text-slate-300">
                            {Number(analytics.avgCo2).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg CO₂
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                      No submissions yet — top emitters appear here.
                    </div>
                  )}
                </div>

                {/* Scope 3 hotspots */}
                <div className="card">
                  <h2 className="font-semibold text-white mb-1">Scope 3 hotspots</h2>
                  <p className="text-xs text-slate-500 mb-3">
                    Suppliers contributing the most to Scope 3 emissions (supply chain).
                  </p>
                  {scope3Hotspots.length > 0 ? (
                    <div className="space-y-3">
                      {scope3Hotspots.map((h) => (
                        <div key={h.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-white font-medium truncate">{h.name}</span>
                            <span className="text-slate-400 shrink-0 ml-2 tabular-nums">
                              {h.scope3.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                            <span>Share of Scope 3</span>
                            <span className="tabular-nums">{h.share}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(h.share, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-slate-600 text-sm">
                      No Scope 3 supplier data yet — hotspots appear once suppliers submit.
                    </div>
                  )}
                </div>
              </div>

              {analytics && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="card">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Average emissions</p>
                    <p className="text-2xl font-black text-white mt-1">
                      {Number(analytics.averageEmissions || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      <span className="text-sm text-slate-400 ml-1">kg CO₂ / supplier</span>
                    </p>
                  </div>
                  <div className="card">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Activity inputs (suppliers)</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 mb-2">Litres · kWh · km — CO₂ shares use the source chart above</p>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Fuel (L)</span><span className="text-white">{Number(analytics.sourceBreakdown?.fuel || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Electricity (kWh)</span><span className="text-white">{Number(analytics.sourceBreakdown?.electricity || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-400">Transport (km)</span><span className="text-white">{Number(analytics.sourceBreakdown?.transportKm || 0).toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="card">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Action needed</p>
                    <p className="text-sm text-slate-300 mt-2">{stats?.pending || 0} suppliers pending and {stats?.overdue || 0} overdue.</p>
                    <Link to="/suppliers" className="inline-block mt-3 text-xs text-brand-400 hover:text-brand-300 underline">Open supplier actions</Link>
                  </div>
                </div>
              )}

              {analytics && (
                <div className="card mb-6">
                  <h2 className="font-semibold text-white mb-3">Compliance And Financial Risk</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500">Compliance mode</p>
                      <p className="text-sm text-brand-300 font-semibold mt-1">{String(analytics.complianceMode || 'standard').toUpperCase()}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500">Region</p>
                      <p className="text-sm text-white font-semibold mt-1">{String(analytics.complianceRegion || 'global').toUpperCase()}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500">Carbon price</p>
                      <p className="text-sm text-white font-semibold mt-1">INR {Number(analytics.carbonPriceInrPerTon || 0).toLocaleString()} / tCO2</p>
                    </div>
                    <div className="p-3 rounded-xl border border-slate-700 bg-slate-900">
                      <p className="text-xs text-slate-500">Estimated cost risk</p>
                      <p className="text-sm text-rose-300 font-semibold mt-1">INR {Number(analytics.estimatedCarbonCostInr || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Scope breakdown visual */}
              {(hasScope1 || hasScope2 || hasScope3) && (
                <div className="card mb-6">
                  <h2 className="font-semibold text-white mb-4">Scope Contribution</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Scope 1 — Direct',     value: stats?.scope1Co2, total: stats?.grandTotal, color: 'bg-orange-500', text: 'text-orange-400' },
                      { label: 'Scope 2 — Electricity', value: stats?.scope2Co2, total: stats?.grandTotal, color: 'bg-blue-500',   text: 'text-blue-400' },
                      { label: 'Scope 3 — Supply chain',value: stats?.scope3Co2, total: stats?.grandTotal, color: 'bg-purple-500', text: 'text-purple-400' },
                    ].map(item => {
                      const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0
                      return (
                        <div key={item.label}>
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className={`font-medium ${item.text}`}>{item.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 tabular-nums">
                                {Number(item.value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                              </span>
                              <span className="text-slate-500 text-xs w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quick actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card">
                  <h2 className="font-semibold text-white mb-4 text-sm">Quick Actions</h2>
                  <div className="space-y-2">
                    {[
                      { to: '/suppliers', label: 'Manage Suppliers', sub: 'Add suppliers or track submissions', color: 'brand' },
                      { to: '/data-entry', label: 'Enter Direct Emissions', sub: 'Record Scope 1 & 2 company data', color: 'orange' },
                      { to: '/reports', label: 'Generate Report', sub: 'Download compliance-ready PDF', color: 'purple' },
                    ].map(item => (
                      <Link key={item.to} to={item.to}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 transition-colors group">
                        <div className={`w-8 h-8 rounded-lg bg-${item.color}-600/15 flex items-center justify-center text-${item.color}-400`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.sub}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="card">
                  <h2 className="font-semibold text-white mb-4 text-sm">Emission Inputs</h2>
                  <div className="space-y-3">
                    {[
                      { label: 'Total Electricity', value: stats?.totalElectricity, unit: 'kWh', color: 'bg-blue-500' },
                      { label: 'Total Fuel', value: stats?.totalFuel, unit: 'L', color: 'bg-orange-500' },
                      { label: 'Total Transport', value: stats?.totalTransport, unit: 'km', color: 'bg-purple-500' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.color} shrink-0`} />
                        <span className="text-sm text-slate-400 flex-1">{item.label}</span>
                        <span className="text-sm font-medium text-white tabular-nums">
                          {item.value ? `${Number(item.value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${item.unit}` : `— ${item.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
