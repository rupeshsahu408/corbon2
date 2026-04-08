import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

const STATUS_BADGE = {
  completed: 'bg-brand-600/20 text-brand-400 border border-brand-600/30',
  pending:   'bg-yellow-600/20 text-yellow-400 border border-yellow-600/30',
  overdue:   'bg-red-600/20 text-red-400 border border-red-600/30',
}

function Toast({ message, type = 'success', onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  const styles = type === 'success'
    ? 'bg-brand-900/90 border-brand-700 text-brand-300'
    : 'bg-red-900/90 border-red-700 text-red-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium ${styles}`}>
      {type === 'success'
        ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
      {message}
    </div>
  )
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [supplierTags, setSupplierTags] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email_or_phone: '' })
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [toast, setToast] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [sendingReminders, setSendingReminders] = useState(false)
  const [network, setNetwork] = useState(null)
  const [connectForm, setConnectForm] = useState({ supplierEmail: '', supplierName: '' })
  const [requestingId, setRequestingId] = useState('')
  const [actioningId, setActioningId] = useState('')
  const csvRef = useRef(null)
  const [detail, setDetail] = useState(null)
  const [scorecards, setScorecards] = useState(new Map())

  async function load() {
    try {
      const [data, tagsRes] = await Promise.all([
        api.getSuppliers(),
        api.getSupplierTags().catch(() => ({ items: [] })),
      ])
      setSuppliers(data)
      setSupplierTags(new Map((tagsRes.items || []).map((x) => [x.supplier_id, x.tags || []])))
      api.getSupplierScorecards()
        .then((res) => {
          const items = res?.items || []
          setScorecards(new Map(items.map((i) => [i.supplier_id, i])))
        })
        .catch(() => {})
      const net = await api.getCompanyNetwork().catch(() => null)
      setNetwork(net)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
  }

  async function handleAdd(e) {
    e.preventDefault()
    setAdding(true)
    setError('')
    try {
      await api.addSupplier(form)
      setForm({ name: '', email_or_phone: '' })
      setShowForm(false)
      await load()
      showToast(`${form.name} added successfully${form.email_or_phone.includes('@') ? ' — invite email sent' : ''}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Remove ${name} from your suppliers?`)) return
    try {
      await api.deleteSupplier(id)
      await load()
      showToast(`${name} removed`)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  function copyLink(token) {
    const url = `${window.location.origin}/supplier/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(token)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a .csv file', 'error')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('csv', file)
      const result = await api.bulkUploadSuppliers(formData)
      await load()
      showToast(`${result.added} supplier(s) added, ${result.invited || 0} invite(s) sent${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSendReminders() {
    setSendingReminders(true)
    try {
      const result = await api.sendReminders()
      showToast(result.message)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSendingReminders(false)
    }
  }

  const overdueCount = suppliers.filter(s => s.status === 'overdue').length

  async function handleResendInvite(supplierId) {
    setActioningId(`invite-${supplierId}`)
    try {
      const result = await api.resendSupplierInvite(supplierId)
      showToast(result.message || 'Invite resent')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActioningId('')
    }
  }

  async function handleSingleReminder(supplierId) {
    setActioningId(`reminder-${supplierId}`)
    try {
      const result = await api.sendSupplierReminder(supplierId)
      showToast(result.message || 'Reminder sent')
      await load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActioningId('')
    }
  }

  async function handleViewData(supplierId) {
    setActioningId(`view-${supplierId}`)
    try {
      const result = await api.getSupplierData(supplierId)
      setDetail(result)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActioningId('')
    }
  }

  async function handleConnectSupplier(e) {
    e.preventDefault()
    try {
      const result = await api.connectSupplier(connectForm)
      setConnectForm({ supplierEmail: '', supplierName: '' })
      await load()
      if (result.invited) {
        showToast(result.message || 'Invite email sent — supplier signs up with the same address to connect.')
      } else {
        showToast('Supplier connected to shared network')
      }
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleRequestUpdate(supplierProfileId) {
    setRequestingId(supplierProfileId)
    try {
      await api.createDataRequest({ supplier_profile_id: supplierProfileId, message: 'Please provide latest shared emission data' })
      showToast('Update request sent')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setRequestingId('')
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 page-header flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Suppliers</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your supply chain and collect emissions data</p>
          </div>
          <div className="flex items-center gap-3">
            {overdueCount > 0 && (
              <button
                onClick={handleSendReminders}
                disabled={sendingReminders}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-700/50 bg-red-950/40 text-red-400 hover:bg-red-900/50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {sendingReminders ? 'Sending...' : `Send Reminders (${overdueCount})`}
              </button>
            )}
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            <button
              onClick={() => csvRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {uploading ? 'Uploading...' : 'Upload CSV'}
            </button>
            <button onClick={() => setShowForm(v => !v)} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add Supplier
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">Shared Supplier Network</h2>
            <form onSubmit={handleConnectSupplier} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input className="input" placeholder="supplier@email.com" value={connectForm.supplierEmail} onChange={(e) => setConnectForm((f) => ({ ...f, supplierEmail: e.target.value }))} required />
              <input className="input" placeholder="Supplier name (optional)" value={connectForm.supplierName} onChange={(e) => setConnectForm((f) => ({ ...f, supplierName: e.target.value }))} />
              <button className="btn-primary" type="submit">Connect Shared Supplier</button>
            </form>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {(network?.sharedSuppliers || []).slice(0, 8).map((s) => (
                <div key={s.supplier_profile_id} className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.email} · score {Number(s.supplier_score ?? s.emission_score ?? 0).toFixed(1)}
                      {s.share_emissions === false ? (
                        <span className="text-amber-400 ml-1">· visibility off</span>
                      ) : null}
                    </p>
                    {s.latest_total_co2 != null && s.latest_period_key ? (
                      <p className="text-xs text-slate-400 mt-1">
                        {s.latest_period_key}: {Number(s.latest_total_co2).toLocaleString()} kg CO₂e (shared)
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">No shared submission yet</p>
                    )}
                  </div>
                  <button onClick={() => handleRequestUpdate(s.supplier_profile_id)} className="text-xs text-brand-400 hover:text-brand-300 shrink-0">
                    {requestingId === s.supplier_profile_id ? 'Sending...' : 'Request Update'}
                  </button>
                </div>
              ))}
              {!network?.sharedSuppliers?.length && <p className="text-sm text-slate-500">No shared suppliers connected yet.</p>}
            </div>
          </div>

          {/* CSV hint */}
          <div className="mb-4 p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            CSV format: <code className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">name, email</code> — one supplier per row. Invite emails sent automatically.
          </div>

          {/* Add form */}
          {showForm && (
            <div className="card mb-6 border-brand-600/30">
              <h2 className="font-semibold text-white mb-4">New Supplier</h2>
              <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Supplier Name</label>
                  <input className="input" placeholder="Acme Manufacturing" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Email or Phone</label>
                  <input className="input" placeholder="contact@supplier.com" value={form.email_or_phone}
                    onChange={e => setForm(f => ({ ...f, email_or_phone: e.target.value }))} required />
                </div>
                <div className="flex items-end gap-2">
                  <button type="submit" disabled={adding} className="btn-primary flex-1">
                    {adding ? 'Adding...' : 'Add Supplier'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4 py-3">Cancel</button>
                </div>
              </form>
              {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-3 text-slate-400 py-12">
              <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              Loading suppliers...
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No suppliers yet</h3>
              <p className="text-slate-400 text-sm mb-6">Add your first supplier to start collecting emissions data.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add First Supplier
              </button>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Supplier</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Contact</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Submission Link</th>
                    <th className="px-6 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {suppliers.map(s => (
                    <tr key={s.id} className={`hover:bg-slate-800/40 transition-colors ${s.status === 'overdue' ? 'bg-red-950/10' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center text-brand-400 text-xs font-bold">
                            {s.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white text-sm">{s.name}</span>
                              <div className="flex items-center gap-1.5">
                                {(supplierTags.get(s.id) || []).slice(0, 2).map((t) => (
                                  <span
                                    key={t.key}
                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                      t.tone === 'danger'
                                        ? 'bg-rose-950/40 border-rose-800/40 text-rose-300'
                                        : t.tone === 'warning'
                                          ? 'bg-yellow-950/40 border-yellow-800/40 text-yellow-300'
                                          : 'bg-blue-950/40 border-blue-800/40 text-blue-300'
                                    }`}
                                  >
                                    {t.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {supplierTags.get(s.id)?.some((t) => t.key === 'pending_data') && (
                              <p className="text-xs text-slate-500 mt-0.5">Missing submission</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{s.email_or_phone}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[s.status] || STATUS_BADGE.pending}`}>
                          {s.status === 'completed' ? 'Completed' : s.status === 'overdue' ? 'Overdue' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => copyLink(s.submission_token)} className="flex items-center gap-2 text-sm text-slate-400 hover:text-brand-400 transition-colors">
                          {copiedId === s.submission_token ? (
                            <><svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-brand-400">Copied!</span></>
                          ) : (
                            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy link</>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResendInvite(s.id)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                          >
                            {actioningId === `invite-${s.id}` ? 'Sending...' : 'Resend Invite'}
                          </button>
                          <button
                            onClick={() => handleSingleReminder(s.id)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-yellow-700/40 text-yellow-300 hover:bg-yellow-950/30"
                          >
                            {actioningId === `reminder-${s.id}` ? 'Sending...' : 'Send Reminder'}
                          </button>
                          <button
                            onClick={() => handleViewData(s.id)}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-brand-700/40 text-brand-300 hover:bg-brand-950/20"
                          >
                            {actioningId === `view-${s.id}` ? 'Loading...' : 'View Supplier Data'}
                          </button>
                          <button onClick={() => handleDelete(s.id, s.name)} className="text-slate-500 hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {detail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDetail(null)} />
          <div className="relative z-50 w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{detail.supplier.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{detail.supplier.email_or_phone}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="text-slate-500 hover:text-slate-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {detail.emissions?.length ? (
              <>
                {(() => {
                  const sc = scorecards.get(detail.supplier.id)
                  if (!sc) return null
                  const tier = sc.scorecard?.tier || 'watch'
                  const tierStyle =
                    tier === 'high-risk'
                      ? 'border-rose-800/50 bg-rose-950/30 text-rose-200'
                      : tier === 'best'
                        ? 'border-emerald-800/50 bg-emerald-950/20 text-emerald-200'
                        : 'border-amber-800/40 bg-amber-950/20 text-amber-200'
                  return (
                    <div className={`border rounded-xl p-3 mb-4 ${tierStyle}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs uppercase tracking-wider opacity-80">Scorecard</p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                          {tier}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="opacity-70">Scope 3 share</p>
                          <p className="font-semibold">{Number(sc.metrics?.scope3_share_pct || 0).toFixed(2)}%</p>
                        </div>
                        <div>
                          <p className="opacity-70">Reminders</p>
                          <p className="font-semibold">{Number(sc.reminder_count || 0)}</p>
                        </div>
                        <div>
                          <p className="opacity-70">Data quality</p>
                          <p className="font-semibold">
                            {sc.quality?.unrealistic_values ? 'flagged' : 'ok'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {['scope1_co2', 'scope2_co2', 'scope3_co2'].map((k, idx) => {
                    const latest = detail.emissions[0]
                    const labels = ['Scope 1', 'Scope 2', 'Scope 3']
                    const colors = ['text-orange-400', 'text-blue-400', 'text-purple-400']
                    return (
                      <div key={k} className="border border-slate-800 rounded-xl p-3">
                        <p className={`text-[11px] uppercase tracking-wider mb-1 ${colors[idx]}`}>{labels[idx]}</p>
                        <p className="text-lg font-bold text-white">
                          {Number(latest[k] || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                          <span className="text-xs text-slate-500">kg</span>
                        </p>
                      </div>
                    )
                  })}
                </div>
                <div className="border border-slate-800 rounded-xl p-3 mb-3">
                  <p className="text-xs text-slate-500 mb-1">Latest activity inputs</p>
                  {(() => {
                    const latest = detail.emissions[0]
                    return (
                      <div className="space-y-1 text-xs text-slate-300">
                        <p>Electricity: {Number(latest.electricity_usage || 0).toLocaleString()} kWh</p>
                        <p>Fuel: {Number(latest.fuel_usage || 0).toLocaleString()} L</p>
                        <p>Transport: {Number(latest.transport_distance || 0).toLocaleString()} km</p>
                      </div>
                    )
                  })()}
                </div>
                <p className="text-[11px] text-slate-500">
                  Showing the most recent submission only. Full history appears in your reports and dashboard totals.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">No submission data yet for this supplier.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
