import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'

export default function Signup() {
  const { signup, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const roleFromUrl = searchParams.get('role')

  const [form, setForm] = useState({ companyName: '', email: '', password: '', confirm: '' })
  const [accountType, setAccountType] = useState('company')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [inviteCompanyName, setInviteCompanyName] = useState('')

  useEffect(() => {
    if (roleFromUrl === 'supplier') setAccountType('supplier')
  }, [roleFromUrl])

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    api.getSupplierInvitePreview(inviteToken)
      .then((inv) => {
        if (cancelled) return
        setAccountType('supplier')
        setForm((f) => ({ ...f, email: inv.email || f.email }))
        setInviteCompanyName(inv.company_name || '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [inviteToken])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await signup(form.email, form.password)
      if (accountType === 'supplier') {
        await api.registerSupplier({
          supplierName: form.companyName || form.email.split('@')[0],
          inviteToken: inviteToken || undefined,
        })
        navigate('/supplier-dashboard')
      } else {
        await api.registerCompany({ companyName: form.companyName, email: form.email })
        navigate('/dashboard')
      }
    } catch (err) {
      if (err.message.includes('email-already-in-use')) {
        setError('This email is already registered. Please sign in.')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    setError('')
    setGoogleLoading(true)
    try {
      const result = await loginWithGoogle()
      const user = result.user
      const companyName = user.displayName || user.email.split('@')[0]
      try {
        if (accountType === 'supplier') {
          await api.registerSupplier({ supplierName: companyName, inviteToken: inviteToken || undefined })
        } else await api.registerCompany({ companyName, email: user.email })
      } catch (regErr) {
        if (!regErr.message.includes('already')) throw regErr
      }
      navigate(accountType === 'supplier' ? '/supplier-dashboard' : '/dashboard')
    } catch (err) {
      if (!err.message.includes('popup-closed-by-user') && !err.message.includes('cancelled-popup-request')) {
        setError('Google sign-up failed. Please try again.')
      }
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-slate-900 to-slate-950 border-r border-slate-800 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-sm text-center">
          <Link to="/" className="flex items-center gap-3 mb-12 justify-center">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-900/50">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">CarbonFlow</span>
          </Link>
          <h2 className="text-3xl font-bold text-white mb-4">Start measuring your Scope 3 emissions today</h2>
          <p className="text-slate-400 leading-relaxed">
            Set up your company, add suppliers, and generate your first emissions report in minutes.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {['No credit card required', 'Supplier forms — no login needed', 'Instant PDF report generation'].map(item => (
              <div key={item} className="flex items-center gap-3 text-slate-300 text-sm">
                <svg className="w-5 h-5 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="font-bold text-white">CarbonFlow</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-slate-400 mb-8">
            {inviteToken && inviteCompanyName
              ? `${inviteCompanyName} invited you to join as a supplier — create your account with the same email.`
              : 'Set up your company in CarbonFlow'}
          </p>

          <div className="mb-5">
            <label className="label">I am signing up as</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAccountType('company')} className={`px-3 py-2 rounded-xl border text-sm ${accountType === 'company' ? 'border-brand-500 text-brand-300 bg-brand-900/20' : 'border-slate-700 text-slate-400 bg-slate-900'}`}>
                Company
              </button>
              <button type="button" onClick={() => setAccountType('supplier')} className={`px-3 py-2 rounded-xl border text-sm ${accountType === 'supplier' ? 'border-brand-500 text-brand-300 bg-brand-900/20' : 'border-slate-700 text-slate-400 bg-slate-900'}`}>
                Supplier
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">{accountType === 'supplier' ? 'Supplier name' : 'Company name'}</label>
              <input
                type="text"
                className="input"
                placeholder="Acme Corporation"
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Work email</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-950/50 border border-red-800/50 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-slate-500 text-xs">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <button
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {googleLoading ? 'Creating account...' : 'Continue with Google'}
          </button>

          <p className="text-center text-slate-400 text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
