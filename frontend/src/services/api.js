import { auth } from '../firebase'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const BASE_URL = API_URL ? `${API_URL}/api` : '/api'

if (import.meta.env.PROD && !API_URL) {
  console.warn('[API] VITE_API_URL is missing in production; API calls will use relative /api and may fail.')
}

async function getHeaders() {
  const token = await auth.currentUser?.getIdToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request(method, path, body) {
  try {
    const headers = await getHeaders()
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    if (!res.ok) {
      const text = await res.text()
      let message = 'Request failed'
      if (text) {
        try {
          const parsed = JSON.parse(text)
          message = parsed.message || message
        } catch {
          message = text
        }
      }
      throw new Error(message)
    }
    return res.json()
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Network error: could not reach API. Check VITE_API_URL and backend CORS.')
    }
    throw err
  }
}

async function requestFormData(method, path, formData) {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(err.message || 'Request failed')
  }
  return res.json()
}

async function getJsonNoAuth(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.message || 'Request failed')
  return json
}

export const api = {
  registerCompany: (data) => request('POST', '/auth/register', data),
  registerSupplier: (data = {}) => request('POST', '/auth/register-supplier', data),
  getSupplierInvitePreview: (token) => getJsonNoAuth(`/invites/supplier/${encodeURIComponent(token)}`),
  getCompany: () => request('GET', '/auth/company'),
  updateOnboarding: (data) => request('POST', '/auth/onboarding', data),

  getSuppliers: () => request('GET', '/suppliers'),
  getSupplierTags: () => request('GET', '/suppliers/tags'),
  addSupplier: (data) => request('POST', '/suppliers', data),
  deleteSupplier: (id) => request('DELETE', `/suppliers/${id}`),
  bulkUploadSuppliers: (formData) => requestFormData('POST', '/suppliers/bulk-upload', formData),
  sendReminders: () => request('POST', '/suppliers/send-reminders'),
  resendSupplierInvite: (id) => request('POST', `/suppliers/${id}/resend-invite`),
  sendSupplierReminder: (id) => request('POST', `/suppliers/${id}/send-reminder`),
  getSupplierData: (id) => request('GET', `/suppliers/${id}/data`),
  uploadSupplierDocument: (id, formData) => requestFormData('POST', `/suppliers/${id}/documents`, formData),

  getDashboardStats: () => request('GET', '/suppliers/stats'),
  getAnalytics: () => request('GET', '/suppliers/analytics'),
  getSupplierScorecards: () => request('GET', '/suppliers/scorecards'),
  getScope3Hotspots: () => request('GET', '/suppliers/hotspots'),

  getProDashboard: () => request('GET', '/pro/dashboard'),
  getProSuppliers: () => request('GET', '/pro/suppliers'),
  getProSupplierDetail: (id) => request('GET', `/pro/suppliers/${id}/detail`),
  getProAlerts: (status = 'open', limit = 50) =>
    request('GET', `/pro/alerts?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(limit)}`),
  acknowledgeProAlert: (id) => request('POST', `/pro/alerts/${id}/acknowledge`),
  resolveProAlert: (id) => request('POST', `/pro/alerts/${id}/resolve`),

  getSupplierForm: (token) => fetch(`${BASE_URL}/emissions/form/${token}`).then(r => r.json()),
  submitEmissions: (token, data) =>
    fetch(`${BASE_URL}/emissions/submit/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(async r => {
      const json = await r.json()
      if (!r.ok) throw new Error(json.message || 'Submission failed')
      return json
    }),

  getReport: (mode = 'standard') => request('GET', `/reports?mode=${encodeURIComponent(mode)}`),
  saveReport: (data) => request('POST', '/reports/save', data),
  getSavedReports: () => request('GET', '/reports/saved'),
  getMethodology: () => getJsonNoAuth('/methodology'),
  getTrustOverview: () => request('GET', '/trust/overview'),
  getDisclosureExport: (framework = 'cdp') =>
    request('GET', `/disclosure/export?framework=${encodeURIComponent(framework)}`),
  createInventorySnapshot: (data) => request('POST', '/reports/inventory-snapshot', data),
  listInventorySnapshots: () => request('GET', '/reports/inventory-snapshots'),

  getDirectEmissions: () => request('GET', '/direct-emissions'),
  addDirectEmission: (data) => request('POST', '/direct-emissions', data),
  deleteDirectEmission: (id) => request('DELETE', `/direct-emissions/${id}`),
  getAuditLog: () => request('GET', '/direct-emissions/audit'),
  bulkUploadDirectEmissions: (formData) => requestFormData('POST', '/direct-emissions/bulk-upload', formData),
  uploadInvoice: (formData) => requestFormData('POST', '/upload-invoice', formData),
  confirmInvoice: (data) => request('POST', '/confirm-invoice', data),

  getMoneyOverview: (syncAlerts = false) =>
    request('GET', `/money/overview${syncAlerts ? '?sync=1' : ''}`),
  postMoneyScenario: (data) => request('POST', '/money/scenario', data),
  patchCarbonPrice: (data) => request('PATCH', '/money/carbon-price', data),

  getIntelligenceOverview: () => request('GET', '/intelligence/overview'),
  getIntelligenceAlerts: (status = 'open') => request('GET', `/intelligence/alerts?status=${encodeURIComponent(status)}`),
  acknowledgeIntelligenceAlert: (id) => request('POST', `/intelligence/alerts/${id}/acknowledge`),
  getIntelligenceSupplierScores: () => request('GET', '/intelligence/supplier-scores'),
  getIntelligenceForecast: () => request('GET', '/intelligence/forecast'),
  getIntelligenceBenchmark: () => request('GET', '/intelligence/benchmark'),
  getPeriodCompare: (current, previous) =>
    request('GET', `/intelligence/period-compare?current=${encodeURIComponent(current)}&previous=${encodeURIComponent(previous)}`),
  chatCarbonAssistant: (question) => request('POST', '/intelligence/assistant/chat', { question }),
  clearCarbonAssistantConversation: () => request('POST', '/intelligence/assistant/clear'),

  getPlatformMe: () => request('GET', '/platform/me'),
  upsertSupplierProfile: (data) => request('POST', '/platform/supplier/profile', data),
  getSupplierDashboard: () => request('GET', '/platform/supplier/dashboard'),
  submitSharedEmission: (data) => request('POST', '/platform/supplier/emissions', data),
  /** Alias — POST /api/supplier/emissions (Phase B supplier network API) */
  submitSupplierEmissions: (data) => request('POST', '/supplier/emissions', data),
  updateSupplierSharing: (companyId, data) => request('PATCH', `/platform/supplier/sharing/${companyId}`, data),
  updateSupplierRequestStatus: (requestId, data) => request('PATCH', `/platform/supplier/requests/${requestId}/status`, data),
  connectSupplier: (data) => request('POST', '/platform/company/connect-supplier', data),
  createDataRequest: (data) => request('POST', '/platform/company/data-request', data),
  getCompanyNetwork: () => request('GET', '/platform/company/network'),
  discoverSuppliers: (params = '') => request('GET', `/platform/company/discover-suppliers${params ? `?${params}` : ''}`),
  getSupplierMarketplace: () => request('GET', '/platform/company/marketplace'),
  connectSupplierProfile: (supplierProfileId) => request('POST', `/platform/company/connect-supplier/${supplierProfileId}`),

  getEnterpriseIntegrations: () => request('GET', '/enterprise/integrations'),
  getEnterpriseIntegrationHealth: () => request('GET', '/enterprise/integrations/health'),
  getEnterpriseIntegrationProviders: () => request('GET', '/enterprise/integrations/providers'),
  createEnterpriseIntegration: (data) => request('POST', '/enterprise/integrations', data),
  syncEnterpriseIntegration: (id) => request('POST', `/enterprise/integrations/${id}/sync`),
  recoverEnterpriseIntegration: (id) => request('POST', `/enterprise/integrations/${id}/recover`),

  getComplianceFrameworks: () => request('GET', '/enterprise/compliance/frameworks'),
  setComplianceRegion: (data) => request('POST', '/enterprise/compliance/region', data),
  getRegionalComplianceReport: (region) => request('GET', `/enterprise/compliance/report/${encodeURIComponent(region)}`),

  getCreditListings: () => request('GET', '/enterprise/marketplace/listings'),
  createCreditListing: (data) => request('POST', '/enterprise/marketplace/listings', data),
  buyCreditListing: (listingId, data) => request('POST', `/enterprise/marketplace/listings/${listingId}/buy`, data),

  getEnterpriseApiKeys: () => request('GET', '/enterprise/api-keys'),
  createEnterpriseApiKey: (data) => request('POST', '/enterprise/api-keys', data),
  revokeEnterpriseApiKey: (id) => request('POST', `/enterprise/api-keys/${id}/revoke`),
  getEnterpriseApiDocs: () => request('GET', '/enterprise/api-docs'),

  getEnterpriseAnalytics: (params = '') => request('GET', `/enterprise/analytics${params ? `?${params}` : ''}`),
  getEnterpriseSecurityOverview: () => request('GET', '/enterprise/security/overview'),
  getEnterpriseAuditLogs: () => request('GET', '/enterprise/security/audit-logs'),
  getPermissionCatalog: () => request('GET', '/enterprise/security/permissions/catalog'),
  getPermissionTemplates: () => request('GET', '/enterprise/security/permissions/templates'),
  exportPermissionTemplates: () => request('GET', '/enterprise/security/permissions/templates/export'),
  importPermissionTemplates: (data) => request('POST', '/enterprise/security/permissions/templates/import', data),
  createPermissionTemplate: (data) => request('POST', '/enterprise/security/permissions/templates', data),
  updatePermissionTemplate: (templateId, data) => request('PATCH', `/enterprise/security/permissions/templates/${templateId}`, data),
  deletePermissionTemplate: (templateId) => request('DELETE', `/enterprise/security/permissions/templates/${templateId}`),
  getCompanyPermissionUsers: () => request('GET', '/enterprise/security/permissions/users'),
  updateUserPermission: (userId, data) => request('POST', `/enterprise/security/permissions/users/${userId}`, data),
  getTemplateDiffForUser: (userId, data) => request('POST', `/enterprise/security/permissions/users/${userId}/template-diff`, data),
  applyPermissionTemplate: (userId, data) => request('POST', `/enterprise/security/permissions/users/${userId}/apply-template`, data),
  bulkApplyPermissionTemplate: (data) => request('POST', '/enterprise/security/permissions/users/bulk-apply-template', data),

  getBillingPlans: () => request('GET', '/enterprise/billing/plans'),
  subscribePlan: (data) => request('POST', '/enterprise/billing/subscribe', data),
  getBillingInvoices: () => request('GET', '/enterprise/billing/invoices'),

  getAiSummary: (data) => request('POST', '/enterprise/ai/summary', data),
  queryAiAssistant: (data) => request('POST', '/enterprise/ai/query', data),
  getAiAnomalies: () => request('GET', '/enterprise/ai/anomalies'),
  getGlobalSettings: () => request('GET', '/enterprise/global/settings'),
  saveGlobalSettings: (data) => request('POST', '/enterprise/global/settings', data),
}
