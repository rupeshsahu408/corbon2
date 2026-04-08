import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../services/api'

const LIMITS = {
  electricity_usage:  { max: 10_000_000, label: 'Electricity usage' },
  fuel_usage:         { max: 1_000_000,  label: 'Fuel usage' },
  transport_distance: { max: 10_000_000, label: 'Transport distance' },
}

function validate(form) {
  const { electricity_usage, fuel_usage, transport_distance } = form
  const values = [electricity_usage, fuel_usage, transport_distance]
  if (values.every(v => v === '')) return 'Please fill in at least one field.'

  for (const [key, val] of Object.entries({ electricity_usage, fuel_usage, transport_distance })) {
    if (val === '') continue
    const num = parseFloat(val)
    if (isNaN(num)) return `${LIMITS[key].label} must be a valid number.`
    if (num < 0) return `${LIMITS[key].label} cannot be negative.`
    if (num > LIMITS[key].max) return `${LIMITS[key].label} seems too high (max ${LIMITS[key].max.toLocaleString()}).`
  }
  return null
}

function Logo() {
  return (
    <div className="flex items-center gap-2 mb-8">
      <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <span className="font-bold text-white">CarbonFlow</span>
    </div>
  )
}

export default function SupplierForm() {
  const { token } = useParams()
  const [supplier, setSupplier] = useState(null)
  const [status, setStatus] = useState('loading')
  const [form, setForm] = useState({ electricity_usage: '', fuel_usage: '', transport_distance: '' })
  const [validationError, setValidationError] = useState('')
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    api.getSupplierForm(token)
      .then(data => {
        if (data.error) setStatus('notfound')
        else if (data.status === 'completed') setStatus('already')
        else { setSupplier(data); setStatus('form') }
      })
      .catch(() => setStatus('notfound'))
  }, [token])

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    setValidationError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError('')
    const err = validate(form)
    if (err) { setValidationError(err); return }
    setStatus('submitting')
    try {
      await api.submitEmissions(token, {
        electricity_usage: form.electricity_usage !== '' ? parseFloat(form.electricity_usage) : undefined,
        fuel_usage: form.fuel_usage !== '' ? parseFloat(form.fuel_usage) : undefined,
        transport_distance: form.transport_distance !== '' ? parseFloat(form.transport_distance) : undefined,
      })
      setStatus('success')
    } catch (err) {
      setServerError(err.message || 'Submission failed. Please try again.')
      setStatus('form')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <Logo />
          <div className="w-16 h-16 bg-red-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Link Not Found</h2>
          <p className="text-slate-400 text-sm">This submission link is invalid or has expired. Please contact the company that sent this link.</p>
        </div>
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <Logo />
          <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Already Submitted</h2>
          <p className="text-slate-400 text-sm">Your emissions data has already been received. Thank you for your contribution.</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <Logo />
          <div className="w-16 h-16 bg-brand-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Submitted Successfully!</h2>
          <p className="text-slate-400 text-sm">Your emissions data has been received and recorded. Thank you for helping measure your carbon impact.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <Logo />
        <div className="card">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-white mb-1">Carbon Data Submission</h1>
            {supplier && (
              <p className="text-slate-400 text-sm">
                Submitting for <span className="text-white font-medium">{supplier.name}</span>
              </p>
            )}
          </div>

          <div className="p-4 bg-brand-600/10 border border-brand-600/20 rounded-xl mb-6">
            <p className="text-brand-300 text-sm leading-relaxed">
              Please enter your annual usage data. Fill in at least one field. This data is used for Scope 3 carbon reporting — no account required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { key: 'electricity_usage', label: 'Electricity Usage (kWh)', hint: 'Total electricity consumed annually', placeholder: 'e.g. 50000' },
              { key: 'fuel_usage', label: 'Fuel Usage (Litres)', hint: 'Diesel, petrol, or other fuel in litres', placeholder: 'e.g. 10000' },
              { key: 'transport_distance', label: 'Transport Distance (km)', hint: 'Total freight/transport kilometres per year', placeholder: 'e.g. 25000' },
            ].map(({ key, label, hint, placeholder }) => (
              <div key={key}>
                <label className="label">
                  {label} <span className="text-slate-500 font-normal ml-1">— annual</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  autoComplete="off"
                  className={`input ${validationError && form[key] !== '' && parseFloat(form[key]) < 0 ? 'border-red-600/50' : ''}`}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => handleChange(key, e.target.value)}
                />
                <p className="text-xs text-slate-500 mt-1">{hint}</p>
              </div>
            ))}

            {(validationError || serverError) && (
              <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {validationError || serverError}
              </div>
            )}

            <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full">
              {status === 'submitting' ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : 'Submit Emissions Data'}
            </button>
          </form>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">Powered by CarbonFlow — Carbon Accounting Platform</p>
      </div>
    </div>
  )
}
