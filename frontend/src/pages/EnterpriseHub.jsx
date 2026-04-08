import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import Sidebar from '../components/Sidebar'
import { api } from '../services/api'

const TABS = ['Integrations', 'Compliance', 'Marketplace', 'API', 'AI', 'Analytics', 'Security', 'Billing', 'Global']

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export default function EnterpriseHub() {
  const [tab, setTab] = useState('Integrations')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState({
    integrations: [],
    integrationHealth: null,
    integrationProviders: [],
    frameworks: [],
    listings: [],
    apiKeys: [],
    apiDocs: null,
    analytics: null,
    security: null,
    permissionCatalog: [],
    permissionTemplates: [],
    permissionUsers: [],
    billing: null,
    invoices: null,
    ai: null,
    anomalies: null,
    regionReport: null,
    region: 'global',
    globalSettings: { locale: 'en', timezone: 'UTC', region_key: 'global' },
  })
  const [newApiKey, setNewApiKey] = useState(null)
  const [lang, setLang] = useState('en')
  const [timezone, setTimezone] = useState('UTC')
  const [complianceMode, setComplianceMode] = useState('standard')
  const [carbonPrice, setCarbonPrice] = useState(2500)
  const [listingDraft, setListingDraft] = useState({ project_name: '', available_credits: 100, price_per_credit: 10, region_key: 'global' })
  const [templateDraftName, setTemplateDraftName] = useState('')
  const [templateDraftPermissions, setTemplateDraftPermissions] = useState([])
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [templateImportJson, setTemplateImportJson] = useState('')
  const [bulkTemplateKey, setBulkTemplateKey] = useState('')
  const [bulkSelectedUsers, setBulkSelectedUsers] = useState([])
  const [templateDiffs, setTemplateDiffs] = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [publicCsvUrl, setPublicCsvUrl] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiQueryAnswer, setAiQueryAnswer] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [
        integrations,
        integrationHealth,
        integrationProviders,
        frameworks,
        listings,
        apiKeys,
        apiDocs,
        analytics,
        security,
        permissionCatalog,
        permissionTemplates,
        permissionUsers,
        billing,
        invoices,
        anomalies,
        globalSettings,
      ] = await Promise.all([
        api.getEnterpriseIntegrations().catch(() => []),
        api.getEnterpriseIntegrationHealth().catch(() => null),
        api.getEnterpriseIntegrationProviders().catch(() => []),
        api.getComplianceFrameworks().catch(() => []),
        api.getCreditListings().catch(() => []),
        api.getEnterpriseApiKeys().catch(() => []),
        api.getEnterpriseApiDocs().catch(() => null),
        api.getEnterpriseAnalytics().catch(() => null),
        api.getEnterpriseSecurityOverview().catch(() => null),
        api.getPermissionCatalog().catch(() => []),
        api.getPermissionTemplates().catch(() => []),
        api.getCompanyPermissionUsers().catch(() => []),
        api.getBillingPlans().catch(() => null),
        api.getBillingInvoices().catch(() => null),
        api.getAiAnomalies().catch(() => null),
        api.getGlobalSettings().catch(() => ({ locale: 'en', timezone: 'UTC', region_key: 'global' })),
      ])
      setLang(globalSettings?.locale || 'en')
      setTimezone(globalSettings?.timezone || 'UTC')
      setComplianceMode(globalSettings?.compliance_mode || 'standard')
      setCarbonPrice(Number(globalSettings?.carbon_price_inr_per_ton || 2500))
      setData((s) => ({
        ...s,
        integrations,
        integrationHealth,
        integrationProviders,
        frameworks,
        listings,
        apiKeys,
        apiDocs,
        analytics,
        security,
        permissionCatalog,
        permissionTemplates,
        permissionUsers,
        billing,
        invoices,
        anomalies,
        globalSettings,
        region: globalSettings?.region_key || 'global',
      }))
    } catch (err) {
      setError(err.message || 'Failed to load enterprise workspace')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const currentFramework = useMemo(
    () => data.frameworks.find((f) => f.region_key === data.region) || null,
    [data.frameworks, data.region]
  )
  const forecastSeries = useMemo(
    () => (data.analytics?.forecast || []).map((point) => ({ name: `M+${point.monthOffset}`, total: Number(point.projected_total_co2 || 0) })),
    [data.analytics]
  )
  const benchmarkSeries = useMemo(
    () => (data.analytics?.benchmark || []).map((row) => ({ metric: row.metric_key, value: Number(row.avg_value || 0) })),
    [data.analytics]
  )
  const anomalySeries = useMemo(
    () => (data.anomalies?.anomalies || []).slice(0, 8).map((item) => ({ supplier: item.supplier, co2: Number(item.total_co2 || 0) })),
    [data.anomalies]
  )
  const invoicePie = useMemo(() => {
    const base = Number(data.invoices?.invoicePreview?.base || 0)
    const usageCharge = Number(data.invoices?.invoicePreview?.usageCharge || 0)
    return [
      { name: 'Subscription', value: base },
      { name: 'Usage', value: usageCharge },
    ]
  }, [data.invoices])
  const filteredPermissionCatalog = useMemo(
    () => (data.permissionCatalog || []).filter((p) => p.toLowerCase().includes(permissionSearch.toLowerCase())),
    [data.permissionCatalog, permissionSearch]
  )
  const filteredUsers = useMemo(
    () => (data.permissionUsers || []).filter((u) => {
      const hay = `${u.display_name || ''} ${u.email || ''}`.toLowerCase()
      return hay.includes(userSearch.toLowerCase())
    }),
    [data.permissionUsers, userSearch]
  )

  async function addIntegration(provider) {
    try {
      await api.createEnterpriseIntegration({ provider, config: { mode: 'api', auto_sync: true } })
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function generateApiKey() {
    try {
      const created = await api.createEnterpriseApiKey({ name: `Enterprise key ${Date.now()}` })
      setNewApiKey(created?.raw_key || null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function generateApiKeyFromTemplate(template) {
    try {
      const created = await api.createEnterpriseApiKey({ name: `${template.label} ${Date.now()}`, scopes: template.scopes })
      setNewApiKey(created?.raw_key || null)
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setRegion(region_key) {
    try {
      await api.setComplianceRegion({ region_key, locale: lang, timezone })
      const report = await api.getRegionalComplianceReport(region_key)
      setData((s) => ({ ...s, region: region_key, regionReport: report }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function runAiSummary() {
    try {
      const ai = await api.getAiSummary({
        payload: {
          analytics: data.analytics?.summary || {},
          marketplace: data.listings?.slice(0, 3) || [],
          region: data.region,
        },
      })
      setData((s) => ({ ...s, ai }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function runAiQuery() {
    try {
      const answer = await api.queryAiAssistant({ question: aiQuestion })
      setAiQueryAnswer(answer.answer || '')
    } catch (err) {
      setError(err.message)
    }
  }

  async function createListing() {
    try {
      await api.createCreditListing(listingDraft)
      setListingDraft({ project_name: '', available_credits: 100, price_per_credit: 10, region_key: data.region || 'global' })
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function buyListing(listingId) {
    try {
      await api.buyCreditListing(listingId, { credits: 10 })
      await loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function saveGlobal() {
    try {
      const updated = await api.saveGlobalSettings({
        region_key: data.region,
        timezone,
        locale: lang,
        compliance_mode: complianceMode,
        carbon_price_inr_per_ton: carbonPrice,
      })
      setData((s) => ({ ...s, globalSettings: updated }))
      await setRegion(updated.region_key)
    } catch (err) {
      setError(err.message)
    }
  }

  async function togglePermission(userId, permissionKey, enabled) {
    try {
      await api.updateUserPermission(userId, { permission_key: permissionKey, granted: enabled })
      const users = await api.getCompanyPermissionUsers()
      setData((s) => ({ ...s, permissionUsers: users }))
    } catch (err) {
      setError(err.message)
    }
  }

  async function applyTemplate(userId, templateKey) {
    try {
      await api.applyPermissionTemplate(userId, { template_key: templateKey })
      const users = await api.getCompanyPermissionUsers()
      setData((s) => ({ ...s, permissionUsers: users }))
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleDraftPermission(permissionKey) {
    setTemplateDraftPermissions((prev) =>
      prev.includes(permissionKey) ? prev.filter((p) => p !== permissionKey) : prev.concat(permissionKey)
    )
  }

  function startEditTemplate(template) {
    if (template.is_system) return
    setEditingTemplateId(template.id)
    setTemplateDraftName(template.name || '')
    setTemplateDraftPermissions(Array.isArray(template.permissions) ? template.permissions : [])
  }

  function resetTemplateDraft() {
    setEditingTemplateId(null)
    setTemplateDraftName('')
    setTemplateDraftPermissions([])
  }

  async function saveTemplateDraft() {
    try {
      if (editingTemplateId) {
        await api.updatePermissionTemplate(editingTemplateId, { name: templateDraftName, permissions: templateDraftPermissions })
      } else {
        await api.createPermissionTemplate({ name: templateDraftName, permissions: templateDraftPermissions })
      }
      const templates = await api.getPermissionTemplates()
      setData((s) => ({ ...s, permissionTemplates: templates }))
      resetTemplateDraft()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeTemplate(templateId) {
    try {
      await api.deletePermissionTemplate(templateId)
      const templates = await api.getPermissionTemplates()
      setData((s) => ({ ...s, permissionTemplates: templates }))
      if (editingTemplateId === templateId) resetTemplateDraft()
    } catch (err) {
      setError(err.message)
    }
  }

  async function exportTemplates() {
    try {
      const payload = await api.exportPermissionTemplates()
      setTemplateImportJson(JSON.stringify(payload, null, 2))
    } catch (err) {
      setError(err.message)
    }
  }

  async function importTemplates() {
    try {
      const parsed = JSON.parse(templateImportJson || '{}')
      await api.importPermissionTemplates(parsed)
      const templates = await api.getPermissionTemplates()
      setData((s) => ({ ...s, permissionTemplates: templates }))
    } catch (err) {
      setError(err.message || 'Invalid JSON import payload')
    }
  }

  async function previewTemplateDiff(userId, templateKey) {
    try {
      const diff = await api.getTemplateDiffForUser(userId, { template_key: templateKey })
      setTemplateDiffs((prev) => ({ ...prev, [`${userId}:${templateKey}`]: diff }))
    } catch (err) {
      setError(err.message)
    }
  }

  function toggleBulkUser(userId, checked) {
    setBulkSelectedUsers((prev) => (checked ? prev.concat(userId) : prev.filter((id) => id !== userId)))
  }

  async function runBulkApplyTemplate() {
    try {
      await api.bulkApplyPermissionTemplate({ template_key: bulkTemplateKey, user_ids: bulkSelectedUsers })
      const users = await api.getCompanyPermissionUsers()
      setData((s) => ({ ...s, permissionUsers: users }))
      setBulkSelectedUsers([])
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen page-main">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="px-8 py-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <h1 className="text-3xl font-bold text-white">CarbonFlow Enterprise Command Center</h1>
          <p className="text-slate-400 text-sm mt-1">Global integrations, compliance automation, API infrastructure, monetization, and AI intelligence.</p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
            <Kpi label="Connected Integrations" value={String(data.integrations?.length || 0)} hint="ERP, accounting, logistics" />
            <Kpi label="Public API Keys" value={String(data.apiKeys?.length || 0)} hint="Rate-limited enterprise access" />
            <Kpi label="Total Suppliers" value={String(data.analytics?.summary?.suppliers || 0)} hint="Active network footprint" />
            <Kpi
              label="Monthly CO2"
              value={`${Math.round(Number(data.analytics?.summary?.total_co2 || 0)).toLocaleString()} kg`}
              hint="Based on submitted emissions"
            />
          </div>
        </div>
        <div className="px-8 py-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg border text-sm ${tab === t ? 'border-brand-500 text-brand-300 bg-brand-900/20' : 'border-slate-700 text-slate-400 bg-slate-900'}`}>
                {t}
              </button>
            ))}
          </div>

          {loading && <p className="text-slate-400">Loading enterprise workspace...</p>}
          {error && <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl text-red-300 text-sm mb-4">{error}</div>}

          {!loading && (
            <>
              {tab === 'Integrations' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-1">Enterprise Integrations</h2>
                  <p className="text-slate-400 text-sm mb-4">Connect SAP, Oracle, Tally, and logistics platforms for zero-manual-entry sync.</p>
                  <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/60 mb-4">
                    <p className="text-white text-sm font-medium">Working integration: Public CSV Connector</p>
                    <p className="text-slate-400 text-xs mt-1">Columns: supplier_name, contact, electricity_usage, fuel_usage, transport_distance</p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2">
                      <input
                        className="input md:col-span-3"
                        placeholder="https://.../emissions.csv"
                        value={publicCsvUrl}
                        onChange={(e) => setPublicCsvUrl(e.target.value)}
                      />
                      <button
                        className="btn-primary px-3 py-2"
                        onClick={() => api.createEnterpriseIntegration({ provider: 'public_csv', config: { csv_url: publicCsvUrl } }).then(loadAll)}
                      >
                        Connect CSV
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-5">
                    {(data.integrationProviders || []).map((p) => (
                      <div key={p.key} className="border border-slate-800 rounded-lg p-4 bg-slate-900/60">
                        <p className="text-white font-medium">{p.name}</p>
                        <p className="text-slate-400 text-xs mt-1">{p.category}</p>
                        <button className="btn-secondary mt-3 px-3 py-2 w-full" onClick={() => addIntegration(p.key)}>Connect</button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {data.integrations.map((i) => (
                      <div key={i.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60 text-sm text-slate-300 flex items-center justify-between gap-2">
                        <span>{i.provider} · {i.status}</span>
                        <div className="flex items-center gap-2">
                          <button className="btn-secondary px-3 py-2" onClick={() => api.syncEnterpriseIntegration(i.id).then(loadAll)}>Sync now</button>
                          <button className="btn-secondary px-3 py-2" onClick={() => api.recoverEnterpriseIntegration(i.id).then(loadAll)}>Recover</button>
                        </div>
                      </div>
                    ))}
                    {!data.integrations.length && <p className="text-slate-500 text-sm">No integrations connected.</p>}
                  </div>
                  {data.integrationHealth && (
                    <div className="mt-4 border border-slate-800 rounded-lg p-3 bg-slate-900/60">
                      <p className="text-sm text-white font-medium mb-2">Integration Reliability Health</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-3">
                        <div className="rounded border border-slate-700 p-2 text-slate-300">Total: {data.integrationHealth.summary?.total || 0}</div>
                        <div className="rounded border border-slate-700 p-2 text-brand-300">Healthy: {data.integrationHealth.summary?.healthy || 0}</div>
                        <div className="rounded border border-slate-700 p-2 text-yellow-300">Degraded: {data.integrationHealth.summary?.degraded || 0}</div>
                        <div className="rounded border border-slate-700 p-2 text-rose-300">Open Circuits: {data.integrationHealth.summary?.openCircuits || 0}</div>
                      </div>
                      <div className="space-y-2">
                        {(data.integrationHealth.items || []).slice(0, 8).map((h) => (
                          <div key={h.id} className="text-xs border border-slate-800 rounded p-2 flex items-center justify-between">
                            <span className="text-slate-300">{h.provider} · failed {h.failed_attempts || 0}</span>
                            <span className={h.circuit_open ? 'text-rose-300' : 'text-brand-300'}>
                              {h.circuit_open ? 'circuit-open' : 'healthy'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Compliance' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Multi-country Compliance</h2>
                  <div className="flex gap-2 mb-3">
                    {(data.frameworks || []).map((f) => (
                      <button key={f.id} onClick={() => setRegion(f.region_key)} className="btn-secondary px-3 py-2">{f.region_key.toUpperCase()}</button>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm mb-2">Selected: {data.region.toUpperCase()} · {currentFramework?.name || 'N/A'}</p>
                  <ul className="text-sm text-slate-300 space-y-1">
                    {(currentFramework?.requirements || []).map((r, idx) => <li key={idx}>- {r}</li>)}
                  </ul>
                  {data.regionReport && (
                    <div className="mt-4 p-3 border border-slate-800 rounded-lg bg-slate-900/60">
                      <p className="text-xs text-slate-500">Regional totals</p>
                      <p className="text-white text-sm mt-1">Total CO2: {Number(data.regionReport.totals?.total || 0).toLocaleString()} kg</p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'Marketplace' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Carbon Credit Marketplace</h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <input className="input md:col-span-2" placeholder="Project name" value={listingDraft.project_name} onChange={(e) => setListingDraft((s) => ({ ...s, project_name: e.target.value }))} />
                    <input className="input" type="number" min="1" placeholder="Credits" value={listingDraft.available_credits} onChange={(e) => setListingDraft((s) => ({ ...s, available_credits: Number(e.target.value || 0) }))} />
                    <input className="input" type="number" min="1" placeholder="Price/credit" value={listingDraft.price_per_credit} onChange={(e) => setListingDraft((s) => ({ ...s, price_per_credit: Number(e.target.value || 0) }))} />
                  </div>
                  <button className="btn-primary mb-4" onClick={createListing}>Create Listing</button>
                  <div className="space-y-2">
                    {(data.listings || []).map((l) => (
                      <div key={l.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60 text-sm text-slate-300 flex items-center justify-between gap-2">
                        <span>{l.project_name} · {l.available_credits} credits · ${l.price_per_credit}/credit</span>
                        <button className="btn-secondary px-3 py-2" onClick={() => buyListing(l.id)}>Buy 10</button>
                      </div>
                    ))}
                    {!data.listings.length && <p className="text-slate-500 text-sm">No listings available.</p>}
                  </div>
                </div>
              )}

              {tab === 'API' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Public API Platform</h2>
                  <button className="btn-primary mb-3" onClick={generateApiKey}>Create API Key</button>
                  <div className="mb-3">
                    <p className="text-xs text-slate-400 mb-2">Scope templates</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Read Basic', scopes: ['read:health', 'read:emissions'] },
                        { label: 'Supplier Partner', scopes: ['read:health', 'read:emissions', 'read:suppliers'] },
                        { label: 'Full Access', scopes: ['*'] },
                      ].map((t) => (
                        <button key={t.label} className="btn-secondary px-3 py-2 text-xs" onClick={() => generateApiKeyFromTemplate(t)}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {newApiKey && <div className="p-3 border border-brand-700 rounded-lg bg-brand-950/20 text-brand-200 text-sm mb-3">New key: {newApiKey}</div>}
                  <div className="space-y-2 mb-3">
                    {(data.apiKeys || []).map((k) => (
                      <div key={k.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60 text-sm text-slate-300">
                        {k.name} · {k.key_prefix}... · {k.status}
                      </div>
                    ))}
                  </div>
                  <pre className="text-xs text-slate-400 bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-auto">{JSON.stringify(data.apiDocs, null, 2)}</pre>
                </div>
              )}

              {tab === 'AI' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Advanced AI Layer</h2>
                  <button className="btn-primary mb-3" onClick={runAiSummary}>Generate AI Summary</button>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">{data.ai?.summary || 'No AI summary yet.'}</p>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input className="input md:col-span-3" placeholder="Ask natural-language question about your carbon data" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} />
                    <button className="btn-secondary" onClick={runAiQuery}>Ask AI</button>
                  </div>
                  {aiQueryAnswer && <p className="text-slate-300 text-sm mt-2">{aiQueryAnswer}</p>}
                  <div className="mt-4 border border-slate-800 rounded-lg p-3 bg-slate-900/60">
                    <p className="text-white text-sm font-medium mb-2">Anomaly Detection</p>
                    {anomalySeries.length ? (
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={anomalySeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="supplier" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip />
                            <Bar dataKey="co2" fill="#f59e0b" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <p className="text-xs text-slate-400">No significant anomalies detected.</p>}
                  </div>
                </div>
              )}

              {tab === 'Analytics' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Enterprise Analytics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <Kpi label="Avg Submission CO2" value={`${Math.round(Number(data.analytics?.summary?.avg_submission_co2 || 0)).toLocaleString()} kg`} />
                    <Kpi label="Forecast (next month)" value={`${Math.round(Number(data.analytics?.forecast?.[0]?.projected_total_co2 || 0)).toLocaleString()} kg`} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 h-72">
                      <p className="text-xs text-slate-400 mb-2">Industry benchmark</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={benchmarkSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="value" name="Average" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 h-72">
                      <p className="text-xs text-slate-400 mb-2">6-month CO2 forecast</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={forecastSeries}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="name" stroke="#94a3b8" />
                          <YAxis stroke="#94a3b8" />
                          <Tooltip />
                          <Line type="monotone" dataKey="total" stroke="#38bdf8" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Security' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Enterprise Security</h2>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 mb-4">
                    <p className="text-sm text-white font-medium mb-2">Security Overview</p>
                    <pre className="text-xs text-slate-400 overflow-auto">{JSON.stringify(data.security, null, 2)}</pre>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 mb-4">
                    <p className="text-sm text-white font-medium mb-3">Template Builder</p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="lg:col-span-2">
                        <label className="label">Template name</label>
                        <input
                          className="input mb-3"
                          value={templateDraftName}
                          onChange={(e) => setTemplateDraftName(e.target.value)}
                          placeholder="e.g. Regional Sustainability Lead"
                        />
                        <p className="text-xs text-slate-400 mb-2">Select permissions for this template</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto pr-1">
                          {filteredPermissionCatalog.map((permissionKey) => (
                            <label key={permissionKey} className="flex items-center gap-2 text-xs text-slate-300 border border-slate-800 rounded px-2 py-1">
                              <input
                                type="checkbox"
                                checked={templateDraftPermissions.includes(permissionKey)}
                                onChange={() => toggleDraftPermission(permissionKey)}
                              />
                              <span>{permissionKey}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button className="btn-primary px-3 py-2" onClick={saveTemplateDraft}>
                            {editingTemplateId ? 'Update template' : 'Create template'}
                          </button>
                          <button className="btn-secondary px-3 py-2" onClick={resetTemplateDraft}>Reset</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-2">Available templates</p>
                        <div className="space-y-2 max-h-72 overflow-auto pr-1">
                          {(data.permissionTemplates || []).map((t) => (
                            <div key={t.key} className="border border-slate-800 rounded-lg p-2">
                              <p className="text-sm text-white">{t.name}</p>
                              <p className="text-xs text-slate-400 mb-2">{Array.isArray(t.permissions) ? t.permissions.length : 0} permissions</p>
                              {!t.is_system && (
                                <div className="flex gap-2">
                                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => startEditTemplate(t)}>Edit</button>
                                  <button className="btn-secondary px-2 py-1 text-xs" onClick={() => removeTemplate(t.id)}>Delete</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <p className="text-xs text-slate-400 mb-2">Import / Export JSON</p>
                      <textarea
                        className="input min-h-36 font-mono text-xs"
                        value={templateImportJson}
                        onChange={(e) => setTemplateImportJson(e.target.value)}
                        placeholder='{"version":1,"templates":[...]}'
                      />
                      <div className="mt-2 flex gap-2">
                        <button className="btn-secondary px-3 py-2 text-xs" onClick={exportTemplates}>Export templates</button>
                        <button className="btn-primary px-3 py-2 text-xs" onClick={importTemplates}>Import templates</button>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 mb-4">
                    <p className="text-sm text-white font-medium mb-2">Bulk Apply Template</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <select className="input" value={bulkTemplateKey} onChange={(e) => setBulkTemplateKey(e.target.value)}>
                        <option value="">Select template</option>
                        {(data.permissionTemplates || []).map((t) => (
                          <option key={t.key} value={t.key}>{t.name}</option>
                        ))}
                      </select>
                      <div className="md:col-span-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-28 overflow-auto pr-1">
                          {(data.permissionUsers || []).map((u) => (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-slate-300 border border-slate-800 rounded px-2 py-1">
                              <input
                                type="checkbox"
                                checked={bulkSelectedUsers.includes(u.id)}
                                onChange={(e) => toggleBulkUser(u.id, e.target.checked)}
                              />
                              <span>{u.display_name || u.email}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn-primary px-3 py-2 text-xs mt-3"
                      onClick={runBulkApplyTemplate}
                      disabled={!bulkTemplateKey || !bulkSelectedUsers.length}
                    >
                      Apply to selected users ({bulkSelectedUsers.length})
                    </button>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                    <p className="text-sm text-white font-medium mb-3">Permissions Admin</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      <input className="input" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} />
                      <input className="input" placeholder="Search permissions..." value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} />
                    </div>
                    <div className="space-y-4">
                      {filteredUsers.map((u) => {
                        const grantedMap = new Map((u.overrides || []).map((o) => [o.permission_key, !!o.granted]))
                        return (
                          <div key={u.id} className="border border-slate-800 rounded-lg p-3">
                            <p className="text-sm text-white">{u.display_name || u.email}</p>
                            <p className="text-xs text-slate-400 mb-2">{u.email}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {(data.permissionTemplates || []).map((t) => (
                                <div key={t.key} className="flex items-center gap-1">
                                  <button
                                    className="btn-secondary px-2 py-1 text-xs"
                                    onClick={() => previewTemplateDiff(u.id, t.key)}
                                  >
                                    Diff {t.name}
                                  </button>
                                  <button
                                    className="btn-secondary px-2 py-1 text-xs"
                                    onClick={() => applyTemplate(u.id, t.key)}
                                  >
                                    Apply
                                  </button>
                                </div>
                              ))}
                            </div>
                            {Object.entries(templateDiffs)
                              .filter(([k]) => k.startsWith(`${u.id}:`))
                              .map(([k, diff]) => (
                                <div key={k} className="mb-3 text-xs border border-slate-800 rounded p-2 bg-slate-950/40">
                                  <p className="text-brand-300 mb-1">Diff for {diff.template_key}</p>
                                  <p className="text-emerald-300">Grant: {(diff.toGrant || []).join(', ') || 'None'}</p>
                                  <p className="text-amber-300">Revoke: {(diff.toRevoke || []).join(', ') || 'None'}</p>
                                </div>
                              ))}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                              {filteredPermissionCatalog.map((permissionKey) => (
                                <label key={permissionKey} className="flex items-center gap-2 text-xs text-slate-300 border border-slate-800 rounded px-2 py-1">
                                  <input
                                    type="checkbox"
                                    checked={grantedMap.get(permissionKey) ?? true}
                                    onChange={(e) => togglePermission(u.id, permissionKey, e.target.checked)}
                                  />
                                  <span>{permissionKey}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {!data.permissionUsers?.length && <p className="text-xs text-slate-400">No company users found for permission management.</p>}
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Billing' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Monetization & Billing</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(data.billing?.plans || []).map((p) => (
                      <div key={p.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/60">
                        <p className="text-white font-medium">{p.name}</p>
                        <p className="text-slate-400 text-sm">${Number(p.monthly_price || 0).toLocaleString()}/mo</p>
                        <button className="btn-secondary mt-2 px-3 py-2" onClick={() => api.subscribePlan({ plan_key: p.plan_key }).then(loadAll)}>Subscribe</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold text-white mb-2">Invoice Preview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={invoicePie} dataKey="value" nameKey="name" outerRadius={90}>
                              {invoicePie.map((entry, idx) => (
                                <Cell key={entry.name} fill={idx === 0 ? '#22c55e' : '#f59e0b'} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                        <p className="text-slate-400 text-xs">Current Period: {data.invoices?.period || 'N/A'}</p>
                        <p className="text-white text-xl font-semibold mt-2">${Number(data.invoices?.invoicePreview?.totalDue || 0).toLocaleString()}</p>
                        <p className="text-slate-400 text-sm">Total due</p>
                        <div className="mt-3 text-sm text-slate-300 space-y-1">
                          {(data.invoices?.invoicePreview?.lineItems || []).map((item, idx) => (
                            <p key={idx}>{item.label}: ${Number(item.amount || 0).toLocaleString()}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'Global' && (
                <div className="card">
                  <h2 className="text-white font-semibold mb-3">Global Expansion Readiness</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Language</label>
                      <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
                        <option value="en">English</option>
                        <option value="hi">Hindi</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Timezone</label>
                      <select className="input" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="Europe/Paris">Europe/Paris</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Compliance mode</label>
                      <select className="input" value={complianceMode} onChange={(e) => setComplianceMode(e.target.value)}>
                        <option value="standard">Standard</option>
                        <option value="brsr">BRSR</option>
                        <option value="cbam">CBAM</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Carbon price (INR / tCO2)</label>
                      <input className="input" type="number" min="1" value={carbonPrice} onChange={(e) => setCarbonPrice(Number(e.target.value || 0))} />
                    </div>
                  </div>
                  <button className="btn-primary mt-3" onClick={saveGlobal}>Save Global Settings</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
