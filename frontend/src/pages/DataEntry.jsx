import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

const FUEL_TYPES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'lpg', label: 'LPG' },
  { value: 'natural_gas', label: 'Natural Gas' },
]

function computePreview(form, factors) {
  const fuel = parseFloat(form.fuel_usage) || 0
  const elec = parseFloat(form.electricity_usage) || 0
  const other = parseFloat(form.other_co2) || 0
  const fuelFactor = factors?.fuel?.[form.fuel_type] ?? 2.68
  const electricityFactor = factors?.electricity ?? 0.233
  const scope1 = fuel * fuelFactor + other
  const scope2 = elec * electricityFactor
  return { scope1: scope1.toFixed(3), scope2: scope2.toFixed(3), total: (scope1 + scope2).toFixed(3) }
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  const base = type === 'error' ? 'bg-red-950 border-red-700 text-red-300' : 'bg-brand-950 border-brand-700 text-brand-300'
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl border text-sm shadow-2xl ${base}`}>
      <span>{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}

export default function DataEntry() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [invoiceParsing, setInvoiceParsing] = useState(false)
  const [invoiceParsed, setInvoiceParsed] = useState(null)
  const [invoiceSelectedUnits, setInvoiceSelectedUnits] = useState('')
  const [invoiceConfirming, setInvoiceConfirming] = useState(false)
  const [methodology, setMethodology] = useState(null)
  const [form, setForm] = useState({
    period_label: '',
    fuel_usage: '',
    fuel_type: 'diesel',
    electricity_usage: '',
    other_description: '',
    other_co2: '',
    notes: '',
  })

  const notify = (msg, type = 'success') => setToast({ msg, type })

  async function load() {
    try {
      setLoading(true)
      const data = await api.getDirectEmissions()
      setRecords(data)
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    api.getMethodology().then(setMethodology).catch(() => setMethodology(null))
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.period_label.trim()) return notify('Period label is required', 'error')
    const hasValue = parseFloat(form.fuel_usage) > 0 || parseFloat(form.electricity_usage) > 0 || parseFloat(form.other_co2) > 0
    if (!hasValue) return notify('Enter at least one emission value', 'error')

    setSubmitting(true)
    try {
      await api.addDirectEmission(form)
      setForm({ period_label: '', fuel_usage: '', fuel_type: 'diesel', electricity_usage: '', other_description: '', other_co2: '', notes: '' })
      setShowForm(false)
      notify('Record saved successfully')
      load()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record?')) return
    try {
      await api.deleteDirectEmission(id)
      notify('Record deleted')
      load()
    } catch (err) {
      notify(err.message, 'error')
    }
  }

  async function handleInvoiceUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      notify('Please upload a PDF invoice', 'error')
      return
    }
    setInvoiceParsing(true)
    try {
      const fd = new FormData()
      fd.append('invoice', file)
      const parsed = await api.uploadInvoice(fd)
      setInvoiceParsed(parsed)
      setInvoiceSelectedUnits(String(parsed.units || ''))
      notify('Invoice parsed successfully')
    } catch (err) {
      setInvoiceParsed(null)
      notify(err.message, 'error')
    } finally {
      setInvoiceParsing(false)
      e.target.value = ''
    }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      notify('Please upload a CSV file (save Excel as CSV first)', 'error')
      e.target.value = ''
      return
    }
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.bulkUploadDirectEmissions(fd)
      notify('CSV uploaded. Direct emissions updated.')
      await load()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      e.target.value = ''
    }
  }

  async function handleConfirmInvoice() {
    const selected = Number(invoiceSelectedUnits || invoiceParsed?.units || 0)
    if (!selected || !Number.isFinite(selected)) {
      notify('Select a valid parsed units value', 'error')
      return
    }
    setInvoiceConfirming(true)
    try {
      await api.confirmInvoice({
        units: selected,
        date: invoiceParsed.date,
      })
      setInvoiceParsed(null)
      setInvoiceSelectedUnits('')
      notify('Invoice confirmed and saved')
      await load()
    } catch (err) {
      notify(err.message, 'error')
    } finally {
      setInvoiceConfirming(false)
    }
  }

  const previewFactors = useMemo(() => {
    const ef = methodology?.emissionFactors
    return ef
      ? { fuel: ef.fuelKgCo2PerUnitByType || {}, electricity: ef.electricityKgCo2PerKwh }
      : null
  }, [methodology])
  const preview = computePreview(form, previewFactors)
  const totalDirectCo2 = records.reduce((s, r) => s + parseFloat(r.total_co2 || 0), 0)
  const totalScope1    = records.reduce((s, r) => s + parseFloat(r.scope1_co2 || 0), 0)
  const totalScope2    = records.reduce((s, r) => s + parseFloat(r.scope2_co2 || 0), 0)

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="px-8 py-6 page-header flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Direct Data Entry</h1>
            <p className="text-slate-400 text-sm mt-1">Record your company's own Scope 1 &amp; 2 emissions</p>
          </div>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {showForm ? 'Cancel' : 'Add Record'}
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Scope explanation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                scope: 'Scope 1', color: 'orange', label: 'Direct emissions',
                desc: 'Fuel burned on-site — diesel, petrol, LPG, natural gas, company vehicles.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />,
              },
              {
                scope: 'Scope 2', color: 'blue', label: 'Indirect electricity',
                desc: 'Purchased electricity consumed by your offices, factories, and facilities.',
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />,
              },
            ].map(({ scope, color, label, desc, icon }) => (
              <div key={scope} className={`card border border-${color}-800/30 bg-${color}-950/10`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-${color}-600/15 flex items-center justify-center text-${color}-400 shrink-0`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{icon}</svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${color}-600/20 text-${color}-400`}>{scope}</span>
                      <span className="text-sm font-semibold text-white">{label}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CSV upload */}
          <div className="card border border-slate-700">
            <h2 className="font-semibold text-white mb-2">Bulk upload — CSV</h2>
            <p className="text-xs text-slate-500 mb-3">
              Upload a CSV of your company&apos;s Scope 1 &amp; 2 entries. Expected columns:
              <span className="font-mono text-slate-300"> period_label, fuel_usage, fuel_type, electricity_usage, other_description, other_co2, notes</span>.
              You can export from Excel/Sheets as CSV.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="input max-w-sm"
              />
              <span className="text-[11px] text-slate-500">
                We&apos;ll calculate CO₂ per row using the same factors as the form below.
              </span>
            </div>
          </div>

          {/* Add record form */}
          <div className="card border border-slate-700">
            <h2 className="font-semibold text-white mb-3">Invoice Upload (Auto Parse)</h2>
            <p className="text-xs text-slate-500 mb-3">Upload electricity bill PDF, preview parsed units, then confirm save.</p>
            <div className="flex items-center gap-3">
              <input type="file" accept=".pdf,application/pdf" onChange={handleInvoiceUpload} className="input max-w-sm" />
              {invoiceParsing && <span className="text-xs text-slate-400">Parsing PDF...</span>}
            </div>
            {invoiceParsed && (
              <div className="mt-4 p-3 rounded-xl border border-slate-800 bg-slate-900/60">
                <p className="text-sm text-white">Parsed preview</p>
                <p className="text-xs text-slate-400 mt-1">
                  Suggested units: <span className="text-white">{invoiceParsed.units} kWh</span>
                  {invoiceParsed.confidence ? <span className="text-slate-500"> (confidence {Math.round(invoiceParsed.confidence * 100)}%)</span> : null}
                </p>
                <p className="text-xs text-slate-400">Date: <span className="text-white">{invoiceParsed.date || 'Not detected'}</span></p>
                {(invoiceParsed.candidates || []).length > 0 && (
                  <div className="mt-3">
                    <label className="text-xs text-slate-400">Detected unit candidates</label>
                    <select
                      className="input mt-1"
                      value={invoiceSelectedUnits}
                      onChange={(e) => setInvoiceSelectedUnits(e.target.value)}
                    >
                      {(invoiceParsed.candidates || []).map((c, idx) => (
                        <option key={`${c.units}-${idx}`} value={String(c.units)}>
                          {c.units} kWh ({Math.round((c.confidence || 0) * 100)}% · {c.evidence})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button className="btn-primary mt-3" onClick={handleConfirmInvoice} disabled={invoiceConfirming}>
                  {invoiceConfirming ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            )}
          </div>

          {showForm && (
            <div className="card border border-slate-700">
              <h2 className="font-semibold text-white mb-5">New Emission Record</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Period Label <span className="text-red-400">*</span>
                  </label>
                  <input
                    name="period_label" value={form.period_label} onChange={handleChange}
                    placeholder='e.g. "2024 Annual" or "Q1 2025"'
                    className="input w-full"
                    required
                  />
                </div>

                {/* Scope 1 */}
                <div className="p-4 rounded-xl bg-orange-950/10 border border-orange-800/20 space-y-3">
                  <p className="text-xs font-bold text-orange-400 uppercase tracking-wider">Scope 1 — Direct Combustion</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fuel Usage (litres)</label>
                      <input
                        name="fuel_usage" value={form.fuel_usage} onChange={handleChange}
                        type="number" min="0" step="any" placeholder="0"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Fuel Type</label>
                      <select name="fuel_type" value={form.fuel_type} onChange={handleChange} className="input w-full">
                        {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Other Direct Source (optional)</label>
                      <input name="other_description" value={form.other_description} onChange={handleChange}
                        placeholder='e.g. "Refrigerant leaks"' className="input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Other CO₂ (kg)</label>
                      <input name="other_co2" value={form.other_co2} onChange={handleChange}
                        type="number" min="0" step="any" placeholder="0" className="input w-full" />
                    </div>
                  </div>
                </div>

                {/* Scope 2 */}
                <div className="p-4 rounded-xl bg-blue-950/10 border border-blue-800/20">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Scope 2 — Purchased Electricity</p>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Electricity Usage (kWh)</label>
                    <input
                      name="electricity_usage" value={form.electricity_usage} onChange={handleChange}
                      type="number" min="0" step="any" placeholder="0"
                      className="input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes / Methodology (optional)</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange}
                    rows={2} placeholder="Describe data sources, measurement methodology, etc."
                    className="input w-full resize-none" />
                </div>

                {/* Live CO2 preview */}
                {(parseFloat(form.fuel_usage) > 0 || parseFloat(form.electricity_usage) > 0 || parseFloat(form.other_co2) > 0) && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-orange-400 font-medium mb-1">Scope 1 CO₂</p>
                      <p className="text-lg font-black text-white">{preview.scope1} <span className="text-xs text-slate-500">kg</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-400 font-medium mb-1">Scope 2 CO₂</p>
                      <p className="text-lg font-black text-white">{preview.scope2} <span className="text-xs text-slate-500">kg</span></p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-400 font-medium mb-1">Total CO₂</p>
                      <p className="text-lg font-black text-white">{preview.total} <span className="text-xs text-slate-500">kg</span></p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={submitting} className="btn-primary">
                    {submitting ? 'Saving...' : 'Save Record'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Totals summary */}
          {records.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total Scope 1', value: totalScope1.toFixed(2), color: 'orange', unit: 'kg CO₂' },
                { label: 'Total Scope 2', value: totalScope2.toFixed(2), color: 'blue', unit: 'kg CO₂' },
                { label: 'Combined Direct', value: totalDirectCo2.toFixed(2), color: 'brand', unit: 'kg CO₂' },
              ].map(item => (
                <div key={item.label} className="card text-center">
                  <p className={`text-xs font-semibold text-${item.color}-400 mb-1`}>{item.label}</p>
                  <p className="text-2xl font-black text-white">{Number(item.value).toLocaleString()}</p>
                  <p className="text-xs text-slate-600 mt-1">{item.unit}</p>
                </div>
              ))}
            </div>
          )}

          {/* Records table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-6 py-4 page-header flex items-center justify-between">
              <h2 className="font-semibold text-white">Recorded Entries</h2>
              <span className="text-xs text-slate-500">{records.length} record(s)</span>
            </div>
            {loading ? (
              <div className="px-6 py-10 flex items-center gap-3 text-slate-400 text-sm">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : records.length === 0 ? (
              <div className="px-6 py-14 text-center text-slate-500 text-sm">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </div>
                No records yet. Click "Add Record" to enter your company's direct emissions.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {['Period', 'Fuel (L)', 'Electricity (kWh)', 'Scope 1 CO₂', 'Scope 2 CO₂', 'Total CO₂', 'Notes', ''].map(h => (
                        <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-white whitespace-nowrap">{r.period_label}</td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {parseFloat(r.fuel_usage) > 0 ? `${Number(r.fuel_usage).toLocaleString()} L (${r.fuel_type})` : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">
                          {parseFloat(r.electricity_usage) > 0 ? `${Number(r.electricity_usage).toLocaleString()} kWh` : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-orange-400 font-medium">{Number(r.scope1_co2).toFixed(2)} kg</td>
                        <td className="px-6 py-4 text-sm text-blue-400 font-medium">{Number(r.scope2_co2).toFixed(2)} kg</td>
                        <td className="px-6 py-4 text-sm font-bold text-white">{Number(r.total_co2).toFixed(2)} kg</td>
                        <td className="px-6 py-4 text-xs text-slate-500 max-w-[160px] truncate">{r.notes || '—'}</td>
                        <td className="px-6 py-4">
                          <button onClick={() => handleDelete(r.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
