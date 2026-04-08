import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'

const COMPANY_TYPES = [
  { value: 'manufacturer', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail / Ecommerce' },
  { value: 'logistics', label: 'Logistics / Transport' },
  { value: 'services', label: 'Services' },
  { value: 'technology', label: 'Technology' },
  { value: 'other', label: 'Other' },
]

const EXPORT_STATUSES = [
  { value: 'yes', label: 'Yes — exporting' },
  { value: 'no', label: 'No — domestic only' },
  { value: 'planning', label: 'Planning to export' },
]

function StepPill({ active, done, children }) {
  const cls = done
    ? 'bg-brand-600/20 text-brand-300 border-brand-600/30'
    : active
      ? 'bg-slate-800 text-white border-slate-700'
      : 'bg-slate-900 text-slate-500 border-slate-800'
  return (
    <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${cls}`}>
      {children}
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1)
  const [company, setCompany] = useState(null)
  const [form, setForm] = useState({
    company_type: '',
    supplier_count_estimate: '',
    exports_status: '',
  })

  const completion = useMemo(() => {
    const a = form.company_type ? 1 : 0
    const b = form.supplier_count_estimate !== '' ? 1 : 0
    const c = form.exports_status ? 1 : 0
    return a + b + c
  }, [form])

  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const c = await api.getCompany()
        if (ignore) return
        setCompany(c)
        if (c?.onboarding_completed_at) {
          navigate('/dashboard', { replace: true })
          return
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    load()
    return () => { ignore = true }
  }, [navigate])

  async function handleFinish() {
    setError('')
    setSaving(true)
    try {
      const supplierCount = form.supplier_count_estimate === '' ? null : Number(form.supplier_count_estimate)
      if (form.supplier_count_estimate !== '' && (!Number.isFinite(supplierCount) || supplierCount < 0)) {
        setError('Supplier count must be a valid number.')
        return
      }
      await api.updateOnboarding({
        company_type: form.company_type,
        supplier_count_estimate: supplierCount,
        exports_status: form.exports_status,
      })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to save onboarding')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading onboarding...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="font-bold text-white">CarbonFlow</span>
        </Link>

        <div className="card">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold text-white">Quick setup</h1>
              <p className="text-slate-400 text-sm mt-1">3 steps. Under 30 seconds.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Signed in as</p>
              <p className="text-xs text-slate-300">{user?.email || company?.email || '—'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <StepPill active={step === 1} done={form.company_type !== ''}>1. Type</StepPill>
            <StepPill active={step === 2} done={form.supplier_count_estimate !== ''}>2. Suppliers</StepPill>
            <StepPill active={step === 3} done={form.exports_status !== ''}>3. Export</StepPill>
            <div className="ml-auto text-xs text-slate-500 tabular-nums">{completion}/3</div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Company type</label>
                <div className="grid grid-cols-2 gap-2">
                  {COMPANY_TYPES.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, company_type: t.value }))}
                      className={`px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                        form.company_type === t.value
                          ? 'border-brand-500 text-brand-300 bg-brand-900/20'
                          : 'border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-primary"
                  disabled={!form.company_type}
                  onClick={() => setStep(2)}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="label">Rough supplier count</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 25"
                  value={form.supplier_count_estimate}
                  onChange={(e) => setForm((f) => ({ ...f, supplier_count_estimate: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">Used to pre-configure your dashboard and progress metrics.</p>
              </div>
              <div className="flex items-center justify-between">
                <button className="btn-secondary" onClick={() => setStep(1)}>Back</button>
                <button className="btn-primary" disabled={form.supplier_count_estimate === ''} onClick={() => setStep(3)}>Continue</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="label">Do you export?</label>
                <div className="space-y-2">
                  {EXPORT_STATUSES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, exports_status: s.value }))}
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                        form.exports_status === s.value
                          ? 'border-brand-500 text-brand-300 bg-brand-900/20'
                          : 'border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button className="btn-secondary" onClick={() => setStep(2)}>Back</button>
                <button
                  className="btn-primary"
                  disabled={!form.exports_status || saving}
                  onClick={handleFinish}
                >
                  {saving ? 'Saving...' : 'Finish setup'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          You can change these later. This just helps CarbonFlow tailor your workspace.
        </p>
      </div>
    </div>
  )
}

