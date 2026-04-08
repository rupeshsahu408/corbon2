import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

export default function SupplierMarketplace() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [minScore, setMinScore] = useState(0)
  const [connectingId, setConnectingId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      params.set('min_score', String(minScore))
      params.set('max_score', '100')
      const rows = await api.discoverSuppliers(params.toString())
      setItems(rows || [])
    } catch (err) {
      setError(err.message || 'Failed to load supplier marketplace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function connectSupplier(supplierProfileId) {
    setConnectingId(supplierProfileId)
    try {
      await api.connectSupplierProfile(supplierProfileId)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setConnectingId('')
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">Supplier Marketplace</h1>
          <p className="text-slate-400 text-sm mt-1">Discover green suppliers and connect to shared data network</p>
        </div>
        <div className="px-8 py-6">
          <div className="card mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input className="input md:col-span-2" placeholder="Search by supplier name or email" value={query} onChange={(e) => setQuery(e.target.value)} />
              <input className="input" type="number" min="0" max="100" value={minScore} onChange={(e) => setMinScore(Number(e.target.value || 0))} />
              <button className="btn-primary" onClick={load}>Search suppliers</button>
            </div>
          </div>

          {loading ? <p className="text-slate-400">Loading marketplace...</p> : null}
          {error ? <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-sm mb-4">{error}</div> : null}

          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {items.map((s) => (
                <div key={s.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-semibold">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${Number(s.emission_score || 0) >= 75 ? 'bg-brand-900/30 border-brand-700/40 text-brand-300' : 'bg-yellow-900/30 border-yellow-700/40 text-yellow-300'}`}>
                      Score {Number(s.emission_score || 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 min-h-10">{s.bio || 'No profile bio yet.'}</p>
                  <p className="text-xs text-slate-500 mt-2">Latest CO2: {Number(s.latest_total_co2 || 0).toLocaleString()} kg</p>
                  <button className="btn-primary w-full mt-4" onClick={() => connectSupplier(s.id)} disabled={connectingId === s.id}>
                    {connectingId === s.id ? 'Connecting...' : 'Connect supplier'}
                  </button>
                </div>
              ))}
              {!items.length && !error && <p className="text-sm text-slate-500">No suppliers found for your filters.</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
