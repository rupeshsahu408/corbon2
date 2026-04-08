import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

function formatInr(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n))
}

function RiskBadge({ level, title }) {
  const styles = {
    high: 'bg-red-950/60 border-red-600/50 text-red-300',
    medium: 'bg-yellow-950/50 border-yellow-600/40 text-yellow-300',
    low: 'bg-emerald-950/40 border-emerald-700/40 text-emerald-300',
  }
  const l = level || 'low'
  return (
    <div className={`rounded-xl border px-4 py-3 ${styles[l] || styles.low}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-80 mb-1">{title}</p>
      <p className="font-semibold text-sm capitalize">{l} risk</p>
    </div>
  )
}

const CostTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-bold">{formatInr(row?.cost_inr)}</p>
      <p className="text-slate-500 mt-0.5">{Number(row?.co2_kg || 0).toLocaleString()} kg CO₂</p>
    </div>
  )
}

export default function FinancialImpact() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [priceInput, setPriceInput] = useState('')
  const [savingPrice, setSavingPrice] = useState(false)
  const [scenarioPct, setScenarioPct] = useState(20)
  const [scenarioResult, setScenarioResult] = useState(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const o = await api.getMoneyOverview(true)
      setData(o)
      setPriceInput(String(o.carbonPriceInrPerTon ?? 2500))
    } catch (e) {
      setError(e.message || 'Failed to load financial impact')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const chartData = useMemo(() => (data?.monthlyCostTrend || []).map((r) => ({
    ...r,
    label: r.month,
  })), [data])

  async function saveCarbonPrice(e) {
    e.preventDefault()
    const n = Number(priceInput)
    if (!Number.isFinite(n) || n < 0) return
    setSavingPrice(true)
    try {
      await api.patchCarbonPrice({ carbon_price_inr_per_ton: n })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPrice(false)
    }
  }

  async function runScenario(e) {
    e.preventDefault()
    setScenarioLoading(true)
    setError('')
    try {
      const r = await api.postMoneyScenario({ emissionReductionPct: scenarioPct })
      setScenarioResult(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setScenarioLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 page-header flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Financial impact</h1>
            <p className="text-slate-400 text-sm mt-1">
              Carbon cost in ₹, export (CBAM-style) risk, and BRSR-style compliance gaps — decision-ready, not consultancy-grade models.
            </p>
          </div>
          <Link to="/insights" className="text-sm text-brand-400 hover:text-brand-300">Open intelligence alerts →</Link>
        </div>

        <div className="px-8 py-6 space-y-6 max-w-6xl">
          {loading && <p className="text-slate-500">Loading…</p>}
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div>
          )}

          {!loading && data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="card lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/80 border-brand-700/20">
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Estimated carbon cost (internal price)</p>
                  <p className="text-4xl sm:text-5xl font-black text-brand-300 mt-2 tabular-nums">
                    {formatInr(data.estimatedCarbonCostInr)}
                  </p>
                  <p className="text-slate-500 text-sm mt-2">
                    {Number(data.totalCo2Kg || 0).toLocaleString()} kg CO₂e ≈ {Number(data.totalTonnesCo2 || 0).toLocaleString()} t × {formatInr(data.carbonPriceInrPerTon)}/t
                  </p>
                  {data.trendCompare?.costChangePctMonthOverMonth != null && (
                    <p className={`text-sm mt-2 ${data.trendCompare.costChangePctMonthOverMonth > 10 ? 'text-amber-400' : 'text-slate-400'}`}>
                      Month-over-month cost change: {data.trendCompare.costChangePctMonthOverMonth.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="card space-y-3">
                  <p className="text-xs text-slate-500 uppercase">Overall</p>
                  <RiskBadge level={data.risks?.overall?.level} title={data.risks?.overall?.label || 'Portfolio'} />
                  <p className="text-xs text-slate-500">
                    Snapshot saved to profile: {formatInr(data.snapshot?.last_carbon_cost_inr)} · {data.snapshot?.last_risk_level}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <RiskBadge level={data.risks?.export?.level} title={data.risks?.export?.label || 'EU / CBAM'} />
                  <p className="text-sm text-slate-400 px-1">{data.risks?.export?.detail}</p>
                  {data.risks?.export?.level === 'high' && (
                    <p className="text-sm text-red-300/90 px-1">Potential tax exposure: plan for embedded emissions reporting and levy scenarios.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <RiskBadge level={data.risks?.compliance?.level} title={data.risks?.compliance?.label || 'BRSR / Scope 3'} />
                  <p className="text-sm text-slate-400 px-1">{data.risks?.compliance?.detail}</p>
                </div>
              </div>

              <div className="card">
                <h2 className="text-white font-semibold mb-1">Monthly cost trend</h2>
                <p className="text-xs text-slate-500 mb-4">₹ estimated from each month&apos;s CO₂ at your carbon price.</p>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CostTooltip />} cursor={{ fill: 'rgba(74,222,128,0.06)' }} />
                      <Bar dataKey="cost_inr" name="Cost ₹" fill="#4ade80" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-slate-500 text-sm py-8 text-center">Not enough monthly history yet — submit more emissions data.</p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <form className="card space-y-3" onSubmit={saveCarbonPrice}>
                  <h2 className="text-white font-semibold">Carbon price (admin)</h2>
                  <p className="text-xs text-slate-500">₹ per metric ton CO₂e — used for all cost estimates on this page.</p>
                  <div className="flex gap-2 flex-wrap items-end">
                    <div className="flex-1 min-w-[140px]">
                      <label className="label">₹ / ton</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="1"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={savingPrice}>{savingPrice ? 'Saving…' : 'Save price'}</button>
                  </div>
                </form>

                <form className="card space-y-3" onSubmit={runScenario}>
                  <h2 className="text-white font-semibold">Scenario: reduce emissions</h2>
                  <p className="text-xs text-slate-500">What-if on total footprint — linear reduction, same price.</p>
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="w-28">
                      <label className="label">Reduction %</label>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        max="95"
                        value={scenarioPct}
                        onChange={(e) => setScenarioPct(Number(e.target.value))}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={scenarioLoading}>
                      {scenarioLoading ? 'Running…' : 'Simulate'}
                    </button>
                  </div>
                  {scenarioResult && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm space-y-1">
                      <p className="text-emerald-400 font-semibold">Savings: {formatInr(scenarioResult.savingsInr)}</p>
                      <p className="text-slate-400">
                        New cost: {formatInr(scenarioResult.scenarioCostInr)} (was {formatInr(scenarioResult.baselineCostInr)})
                      </p>
                      <p className="text-slate-500 text-xs">
                        {Number(scenarioResult.baselineCo2Kg).toLocaleString()} → {Number(scenarioResult.scenarioCo2Kg).toLocaleString()} kg
                      </p>
                    </div>
                  )}
                </form>
              </div>

              <div className="card">
                <h2 className="text-white font-semibold mb-3">Recommendations</h2>
                <ul className="space-y-3">
                  {(data.recommendations || []).map((r) => (
                    <li key={r.key} className="flex gap-3 text-sm border-b border-slate-800/80 pb-3 last:border-0 last:pb-0">
                      <span className="text-brand-400 shrink-0">→</span>
                      <div>
                        <p className="text-white font-medium">{r.title}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{r.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {!(data.recommendations || []).length && <p className="text-slate-500 text-sm">No extra actions — keep monitoring trends.</p>}
              </div>

              <div className="text-xs text-slate-600">
                Company flags: industry {data.companyFlags?.industryKey}, type {data.companyFlags?.companyType || '—'},
                exports {data.companyFlags?.exportsStatus || '—'}, supplier data {data.companyFlags?.supplierCompletionPct}% complete.
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
