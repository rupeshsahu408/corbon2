import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'
import SupplierDetailPanel from '../components/pro/SupplierDetailPanel'

const RISK_BADGE = {
  red: 'bg-red-600/20 text-red-300 border border-red-600/30',
  yellow: 'bg-yellow-600/20 text-yellow-300 border border-yellow-600/30',
  green: 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/30',
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? 'border-brand-500 text-brand-200 bg-brand-900/20'
          : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

export default function ProSuppliers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alertActioningId, setAlertActioningId] = useState('')

  const [filterHigh, setFilterHigh] = useState(false)
  const [filterLowQuality, setFilterLowQuality] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all') // all | completed | pending
  const [categoryFilter, setCategoryFilter] = useState('all') // all | fuel | electricity | transport
  const [selectedSupplierId, setSelectedSupplierId] = useState('')

  useEffect(() => {
    let ignore = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await api.getProSuppliers()
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

  const rows = useMemo(() => {
    const items = Array.isArray(data?.items) ? data.items : []
    return items
      .filter((r) => (filterHigh ? r.isHighEmitter : true))
      .filter((r) => (filterLowQuality ? r.isLowDataQuality : true))
      .filter((r) => {
        if (statusFilter === 'completed') return r.isCompleted
        if (statusFilter === 'pending') return !r.isCompleted
        return true
      })
      .filter((r) => (categoryFilter === 'all' ? true : r.dominantCategory === categoryFilter))
  }, [data, filterHigh, filterLowQuality, statusFilter, categoryFilter])
  const alerts = Array.isArray(data?.alerts) ? data.alerts : []
  const rankings = data?.rankings || {}

  async function refresh() {
    const res = await api.getProSuppliers()
    setData(res)
  }

  async function handleAcknowledge(id) {
    setAlertActioningId(`ack-${id}`)
    try {
      await api.acknowledgeProAlert(id)
      await refresh()
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
      await refresh()
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
        <div className="px-8 py-6 page-header flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">PRO Suppliers</h1>
            <p className="text-slate-400 text-sm mt-1">Detailed layer with filters + drill-down</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Pill active={filterHigh} onClick={() => setFilterHigh((v) => !v)}>High emitters</Pill>
            <Pill active={filterLowQuality} onClick={() => setFilterLowQuality((v) => !v)}>Low data quality</Pill>
            <Pill active={statusFilter === 'completed'} onClick={() => setStatusFilter((v) => (v === 'completed' ? 'all' : 'completed'))}>Completed</Pill>
            <Pill active={statusFilter === 'pending'} onClick={() => setStatusFilter((v) => (v === 'pending' ? 'all' : 'pending'))}>Pending</Pill>
            <select
              className="input !py-2 !text-xs !w-auto"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="fuel">Fuel</option>
              <option value="electricity">Electricity</option>
              <option value="transport">Transport</option>
            </select>
          </div>
        </div>

        <div className="px-8 py-6">
          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading PRO suppliers...
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">{error}</div>
          ) : (
            <>
              {alerts.length > 0 && (
                <div className="card mb-4">
                  <h2 className="font-semibold text-white text-sm mb-3">Advanced alerts</h2>
                  <ul className="space-y-2">
                    {alerts.slice(0, 5).map((a) => {
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
                              <button type="button" onClick={() => handleAcknowledge(a.id)} className="text-[11px] underline">
                                {alertActioningId === `ack-${a.id}` ? 'Saving...' : 'Acknowledge'}
                              </button>
                              <button type="button" onClick={() => handleResolve(a.id)} className="text-[11px] underline">
                                {alertActioningId === `res-${a.id}` ? 'Saving...' : 'Resolve'}
                              </button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
              <div className="card p-0 overflow-hidden">
                <div className="px-6 py-4 page-header flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Grand total: <span className="text-slate-300 font-semibold tabular-nums">{Number(data?.grandTotalKg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
                </p>
                <p className="text-xs text-slate-500">{rows.length} supplier(s)</p>
              </div>
              <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/40">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider mb-1">Top emitters</p>
                    <p className="text-slate-300">
                      {(rankings.topEmitters || []).slice(0, 3).map((r) => `#${r.rank} ${r.name}`).join(' · ') || 'No data'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider mb-1">Best performers</p>
                    <p className="text-slate-300">
                      {(rankings.bestPerformers || []).slice(0, 3).map((r) => `#${r.rank} ${r.name}`).join(' · ') || 'No data'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 uppercase tracking-wider mb-1">Most improved</p>
                    <p className="text-slate-300">
                      {(rankings.mostImproved || []).slice(0, 3).map((r) => `#${r.rank} ${r.name}`).join(' · ') || 'No data'}
                    </p>
                  </div>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total CO₂</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">S1 %</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">S2 %</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">S3 %</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Category %</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">% of total</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Completeness</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((r) => (
                    <tr key={r.supplierId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 text-xs font-bold">
                            {r.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{r.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {r.dominantCategory === 'fuel' ? 'Fuel' : r.dominantCategory === 'electricity' ? 'Electricity' : 'Transport'}
                              {' '}· {r.status}
                            </p>
                            {(r.ranking?.emitterRank || r.ranking?.bestPerformerRank || r.ranking?.mostImprovedRank) && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {r.ranking?.emitterRank ? `Emitter #${r.ranking.emitterRank}` : ''}
                                {r.ranking?.bestPerformerRank ? `${r.ranking?.emitterRank ? ' · ' : ''}Best #${r.ranking.bestPerformerRank}` : ''}
                                {r.ranking?.mostImprovedRank ? `${(r.ranking?.emitterRank || r.ranking?.bestPerformerRank) ? ' · ' : ''}Improved #${r.ranking.mostImprovedRank}` : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-white tabular-nums">
                        {Number(r.totalCo2Kg || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">{Number(r.scopeContributionsPct?.scope1 || 0).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">{Number(r.scopeContributionsPct?.scope2 || 0).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">{Number(r.scopeContributionsPct?.scope3 || 0).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">
                        {r.dominantCategory === 'fuel'
                          ? `${Number(r.categoryContributionsPct?.fuel || 0).toFixed(1)}%`
                          : r.dominantCategory === 'electricity'
                            ? `${Number(r.categoryContributionsPct?.electricity || 0).toFixed(1)}%`
                            : `${Number(r.categoryContributionsPct?.transport || 0).toFixed(1)}%`}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">{Number(r.contributionPctOfGrandTotal || 0).toFixed(1)}%</td>
                      <td className="px-6 py-4 text-right text-sm text-slate-300 tabular-nums">{Number(r.dataCompletenessPct || 0)}%</td>
                      <td className="px-6 py-4">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${RISK_BADGE[r.riskTone] || RISK_BADGE.yellow}`}>
                          {r.riskTag}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSupplierId(r.supplierId)}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-brand-700/40 text-brand-300 hover:bg-brand-950/20"
                        >
                          View Supplier
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-600 text-sm">
                        No suppliers match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      </main>

      {selectedSupplierId && (
        <SupplierDetailPanel supplierId={selectedSupplierId} onClose={() => setSelectedSupplierId('')} />
      )}
    </div>
  )
}

