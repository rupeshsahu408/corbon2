import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import Sidebar from '../components/Sidebar'

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function SupplierDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [period, setPeriod] = useState(currentPeriod())
  const [emissionForm, setEmissionForm] = useState({ electricity_usage: '', fuel_usage: '', transport_distance: '' })
  const [profileName, setProfileName] = useState('')
  const [profileBio, setProfileBio] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [savingPermissionId, setSavingPermissionId] = useState('')
  const [updatingRequestId, setUpdatingRequestId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      let dashboard
      try {
        dashboard = await api.getSupplierDashboard()
      } catch (err) {
        if ((err.message || '').toLowerCase().includes('profile not found')) {
          await api.registerSupplier()
          dashboard = await api.getSupplierDashboard()
        } else {
          throw err
        }
      }
      setData(dashboard)
      setProfileName(dashboard?.profile?.name || '')
      setProfileBio(dashboard?.profile?.bio || '')
      setIsPublic(!!dashboard?.profile?.is_public)
    } catch (err) {
      setError(err.message || 'Failed to load supplier dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function saveProfile() {
    try {
      await api.upsertSupplierProfile({ name: profileName, bio: profileBio, is_public: isPublic })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function submitEmission(e) {
    e.preventDefault()
    try {
      await api.submitSupplierEmissions({
        period_key: period,
        electricity_usage: Number(emissionForm.electricity_usage || 0),
        fuel_usage: Number(emissionForm.fuel_usage || 0),
        transport_distance: Number(emissionForm.transport_distance || 0),
      })
      setEmissionForm({ electricity_usage: '', fuel_usage: '', transport_distance: '' })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setSharing(companyId, permission_level) {
    setSavingPermissionId(companyId)
    try {
      await api.updateSupplierSharing(companyId, {
        permission_level,
        can_view_scope1: true,
        can_view_scope2: true,
        can_view_scope3: permission_level === 'detailed',
      })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPermissionId('')
    }
  }

  async function setShareEmissions(companyId, share_emissions) {
    setSavingPermissionId(companyId)
    try {
      await api.updateSupplierSharing(companyId, { share_emissions })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPermissionId('')
    }
  }

  async function updateRequestStatus(requestId, status) {
    setUpdatingRequestId(requestId)
    try {
      await api.updateSupplierRequestStatus(requestId, { status })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingRequestId('')
    }
  }

  const totalShared = useMemo(
    () => (data?.history || []).reduce((acc, row) => acc + Number(row.total_co2 || 0), 0),
    [data]
  )

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white">Supplier Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Manage shared emissions, company connections, and requests</p>
        </div>
        <div className="px-8 py-6 space-y-6">
          {loading ? <p className="text-slate-400">Loading supplier data...</p> : null}
          {error ? <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-sm">{error}</div> : null}
          {!loading && data && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card">
                  <p className="text-xs text-slate-500">Emission score</p>
                  <p className="text-3xl font-black text-brand-400 mt-1">{Number(data.profile?.supplier_score ?? data.profile?.emission_score ?? 0).toFixed(1)}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-slate-500">Connected companies</p>
                  <p className="text-3xl font-black text-white mt-1">{data.connections?.length || 0}</p>
                </div>
                <div className="card">
                  <p className="text-xs text-slate-500">Total shared emissions</p>
                  <p className="text-3xl font-black text-white mt-1">{totalShared.toLocaleString()} kg</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Supplier profile</h2>
                  <div className="space-y-3">
                    <input className="input" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Supplier name" />
                    <textarea className="input min-h-20" value={profileBio} onChange={(e) => setProfileBio(e.target.value)} placeholder="Short supplier profile bio" />
                    <label className="text-xs text-slate-400 flex items-center gap-2">
                      <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                      Public profile visible in supplier discovery
                    </label>
                    <button className="btn-primary" onClick={saveProfile}>Save profile</button>
                  </div>
                </div>

                <form className="card" onSubmit={submitEmission}>
                  <h2 className="text-white font-semibold mb-3">Submit shared emission data</h2>
                  <div className="space-y-3">
                    <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="YYYY-MM" />
                    <input className="input" type="number" min="0" step="any" placeholder="Electricity usage" value={emissionForm.electricity_usage} onChange={(e) => setEmissionForm((f) => ({ ...f, electricity_usage: e.target.value }))} />
                    <input className="input" type="number" min="0" step="any" placeholder="Fuel usage" value={emissionForm.fuel_usage} onChange={(e) => setEmissionForm((f) => ({ ...f, fuel_usage: e.target.value }))} />
                    <input className="input" type="number" min="0" step="any" placeholder="Transport distance" value={emissionForm.transport_distance} onChange={(e) => setEmissionForm((f) => ({ ...f, transport_distance: e.target.value }))} />
                    <button className="btn-primary" type="submit">Save and auto-sync</button>
                  </div>
                </form>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Company connections</h2>
                  <div className="space-y-2">
                    {(data.connections || []).map((c) => (
                      <div key={c.id} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                        <p className="text-white text-sm">{c.company_name}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Sharing: {c.permission_level}
                          {c.share_emissions === false ? (
                            <span className="ml-2 text-amber-400">· emissions hidden from this company</span>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button className="text-xs text-slate-300 hover:text-white" onClick={() => setSharing(c.company_id, 'summary')}>
                            {savingPermissionId === c.company_id ? 'Saving...' : 'Summary only'}
                          </button>
                          <button className="text-xs text-brand-300 hover:text-brand-200" onClick={() => setSharing(c.company_id, 'detailed')}>
                            Detailed
                          </button>
                          <button
                            className="text-xs text-slate-400 hover:text-amber-300"
                            type="button"
                            onClick={() => {
                              const visible = c.share_emissions !== false
                              setShareEmissions(c.company_id, !visible)
                            }}
                          >
                            {savingPermissionId === c.company_id
                              ? 'Saving...'
                              : c.share_emissions === false
                                ? 'Allow data visibility'
                                : 'Hide emissions from company'}
                          </button>
                        </div>
                      </div>
                    ))}
                    {!data.connections?.length && <p className="text-sm text-slate-500">No company links yet.</p>}
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Data requests</h2>
                  <div className="space-y-2">
                    {(data.requests || []).slice(0, 8).map((r) => (
                      <div key={r.id} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60">
                        <p className="text-sm text-white">{r.company_name} · {r.period_key}</p>
                        <p className="text-xs text-slate-500 mt-1">{r.message || 'Update request'}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-brand-400">{r.status}</p>
                          <div className="flex gap-2">
                            <button
                              className="text-[11px] text-slate-300 hover:text-white"
                              onClick={() => updateRequestStatus(r.id, 'in_progress')}
                            >
                              {updatingRequestId === r.id ? 'Saving...' : 'In progress'}
                            </button>
                            <button className="text-[11px] text-brand-300 hover:text-brand-200" onClick={() => updateRequestStatus(r.id, 'completed')}>
                              Complete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!data.requests?.length && <p className="text-sm text-slate-500">No requests.</p>}
                  </div>
                </div>
              </div>

              <div className="card">
                <h2 className="text-white font-semibold mb-3">Improvement suggestions</h2>
                <ul className="space-y-2">
                  {(data.suggestions || []).map((s) => <li key={s.key} className="text-sm text-slate-300">- {s.title}</li>)}
                </ul>
                <p className="text-xs text-slate-500 mt-4">
                  Need company-level insights? <Link className="text-brand-400 underline" to="/insights">Open insights</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
