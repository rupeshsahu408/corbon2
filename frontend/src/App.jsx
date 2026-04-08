import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import { api } from './services/api'
import { useEffect, useState, lazy, Suspense } from 'react'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Suppliers = lazy(() => import('./pages/Suppliers'))
const ProDashboard = lazy(() => import('./pages/ProDashboard'))
const ProSuppliers = lazy(() => import('./pages/ProSuppliers'))
const Reports = lazy(() => import('./pages/Reports'))
const DataEntry = lazy(() => import('./pages/DataEntry'))
const SupplierForm = lazy(() => import('./pages/SupplierForm'))
const Insights = lazy(() => import('./pages/Insights'))
const SupplierDashboard = lazy(() => import('./pages/SupplierDashboard'))
const EnterpriseHub = lazy(() => import('./pages/EnterpriseHub'))
const SupplierMarketplace = lazy(() => import('./pages/SupplierMarketplace'))
const FinancialImpact = lazy(() => import('./pages/FinancialImpact'))
const HowToUse = lazy(() => import('./pages/HowToUse'))

function CompanyGate({ children }) {
  const [status, setStatus] = useState('loading') // loading | ok | needs | error
  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const company = await api.getCompany()
        if (ignore) return
        if (!company?.onboarding_completed_at) setStatus('needs')
        else setStatus('ok')
      } catch {
        if (!ignore) setStatus('needs')
      }
    }
    load()
    return () => { ignore = true }
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (status === 'needs') return <Navigate to="/onboarding" replace />
  return children
}

function App() {
  const { user, roles, loading, firebaseConfigured, firebaseConfigError } = useAuth()
  const hasSupplierRole = roles.some((r) => r.role === 'supplier')
  const hasCompanyRole = roles.some((r) => r.role === 'company')

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading CarbonFlow...</p>
        </div>
      </div>
    )
  }

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-2xl font-bold mb-2">Setup Required</h1>
          <p className="text-slate-300 mb-4">
            Frontend Firebase configuration is missing, so the app cannot load authentication.
          </p>
          <p className="text-sm text-rose-300 mb-4">{firebaseConfigError}</p>
          <p className="text-sm text-slate-400">
            Create <code>frontend/.env</code> from <code>frontend/.env.example</code> and fill all Firebase values, then restart the dev server.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={user ? <Navigate to={hasSupplierRole && !hasCompanyRole ? "/supplier-dashboard" : "/dashboard"} replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/how-to-use" element={<HowToUse />} />
        <Route path="/supplier/:token" element={<SupplierForm />} />
        <Route path="/dashboard" element={<ProtectedRoute><CompanyGate><Dashboard /></CompanyGate></ProtectedRoute>} />
        <Route path="/pro/dashboard" element={<ProtectedRoute><CompanyGate><ProDashboard /></CompanyGate></ProtectedRoute>} />
        <Route path="/supplier-dashboard" element={<ProtectedRoute><SupplierDashboard /></ProtectedRoute>} />
        <Route path="/suppliers" element={<ProtectedRoute><CompanyGate><Suppliers /></CompanyGate></ProtectedRoute>} />
        <Route path="/pro/suppliers" element={<ProtectedRoute><CompanyGate><ProSuppliers /></CompanyGate></ProtectedRoute>} />
        <Route path="/data-entry" element={<ProtectedRoute><CompanyGate><DataEntry /></CompanyGate></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><CompanyGate><Reports /></CompanyGate></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><CompanyGate><Insights /></CompanyGate></ProtectedRoute>} />
        <Route path="/financial-impact" element={<ProtectedRoute><CompanyGate><FinancialImpact /></CompanyGate></ProtectedRoute>} />
        <Route path="/enterprise" element={<ProtectedRoute><CompanyGate><EnterpriseHub /></CompanyGate></ProtectedRoute>} />
        <Route path="/supplier-marketplace" element={<ProtectedRoute><CompanyGate><SupplierMarketplace /></CompanyGate></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
