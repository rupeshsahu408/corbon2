const crypto = require('crypto')
const { query } = require('../models/db')
const { hashKey } = require('../middleware/apiKeyAuth')
const { resolveCompanyContext } = require('../services/enterpriseContext')
const { generateSummary, generateQueryAnswer } = require('../services/enterpriseAi')
const { encryptJson } = require('../services/cryptoVault')
const { getQueue } = require('../services/queue')
const { executeIntegrationSync } = require('../services/integrationSync')
const Redis = require('ioredis')

function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const analyticsCache = new Map()
const ANALYTICS_TTL_MS = 60 * 1000
let redisCache = null

function getAnalyticsCacheKey(companyId, from, to) {
  return `${companyId}:${from}:${to}`
}

function getRedisCache() {
  if (redisCache) return redisCache
  const url = process.env.REDIS_URL
  if (!url) return null
  redisCache = new Redis(url, { maxRetriesPerRequest: 1 })
  return redisCache
}

async function getCachedAnalytics(cacheKey) {
  const redis = getRedisCache()
  if (redis) {
    try {
      const raw = await redis.get(`enterprise_analytics:${cacheKey}`)
      if (raw) return JSON.parse(raw)
    } catch {}
  }
  const cached = analyticsCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.payload
  return null
}

async function setCachedAnalytics(cacheKey, payload) {
  const redis = getRedisCache()
  if (redis) {
    try {
      await redis.set(`enterprise_analytics:${cacheKey}`, JSON.stringify(payload), 'EX', Math.floor(ANALYTICS_TTL_MS / 1000))
    } catch {}
  }
  analyticsCache.set(cacheKey, { payload, expiresAt: Date.now() + ANALYTICS_TTL_MS })
}

async function getIntegrationConnections(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  if (!companyId) return res.status(404).json({ message: 'Company not found' })
  const result = await query('SELECT * FROM integration_connections WHERE company_id = $1 ORDER BY created_at DESC', [companyId])
  res.json(result.rows)
}

async function getIntegrationProviders(req, res) {
  res.json([
    { key: 'public_csv', name: 'Public CSV Connector', category: 'ERP/Accounting Export', status: 'available', config_hint: 'csv_url' },
    { key: 'sap', name: 'SAP S/4HANA', category: 'ERP', status: 'available' },
    { key: 'oracle', name: 'Oracle ERP Cloud', category: 'ERP', status: 'available' },
    { key: 'tally', name: 'TallyPrime', category: 'Accounting', status: 'available' },
    { key: 'quickbooks', name: 'QuickBooks', category: 'Accounting', status: 'available' },
    { key: 'netsuite', name: 'NetSuite', category: 'ERP', status: 'available' },
    { key: 'dhl', name: 'DHL Logistics', category: 'Logistics', status: 'available' },
    { key: 'fedex', name: 'FedEx Logistics', category: 'Logistics', status: 'available' },
  ])
}

async function createIntegrationConnection(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  if (!companyId) return res.status(404).json({ message: 'Company not found' })
  const { provider, config = {}, secret = null } = req.body
  if (provider === 'public_csv') {
    const csvUrl = config?.csv_url
    if (!csvUrl) return res.status(400).json({ message: 'public_csv requires config.csv_url' })
    try {
      const parsed = new URL(csvUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(400).json({ message: 'csv_url must use http/https' })
      }
    } catch {
      return res.status(400).json({ message: 'Invalid csv_url' })
    }
  }
  const result = await query(
    `INSERT INTO integration_connections (company_id, provider, config, status, last_sync_at)
     VALUES ($1,$2,$3,'connected',NOW()) RETURNING *`,
    [companyId, provider, JSON.stringify(config)]
  )
  if (secret) {
    const encrypted = encryptJson(secret)
    await query(
      `INSERT INTO integration_secrets (connection_id, encrypted_secret)
       VALUES ($1,$2)
       ON CONFLICT (connection_id) DO UPDATE SET encrypted_secret = EXCLUDED.encrypted_secret, updated_at = NOW()`,
      [result.rows[0].id, encrypted]
    )
  }
  res.status(201).json(result.rows[0])
}

async function triggerIntegrationSync(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { id } = req.params
  const exists = await query('SELECT id FROM integration_connections WHERE id = $1 AND company_id = $2 LIMIT 1', [id, companyId])
  if (!exists.rows.length) return res.status(404).json({ message: 'Integration not found' })

  const queue = getQueue('integration-sync')
  if (queue) {
    await queue.add('sync', { companyId, connectionId: id }, { removeOnComplete: true, removeOnFail: 100 })
    return res.json({ message: 'Sync queued' })
  }

  // Fallback: run inline when Redis is not configured
  const sync = await executeIntegrationSync(companyId, id)
  const result = await query('SELECT * FROM integration_connections WHERE id = $1 LIMIT 1', [id])
  return res.json({ message: 'Sync completed', sync, integration: result.rows[0] })
}

async function getIntegrationHealth(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  if (!companyId) return res.status(404).json({ message: 'Company not found' })
  const result = await query(
    `SELECT id, provider, status, last_sync_at, last_error, failed_attempts, circuit_open_until, created_at
     FROM integration_connections
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  )
  const now = Date.now()
  const items = result.rows.map((r) => ({
    ...r,
    circuit_open: !!(r.circuit_open_until && new Date(r.circuit_open_until).getTime() > now),
  }))
  const summary = {
    total: items.length,
    healthy: items.filter((i) => i.status === 'connected' && !i.circuit_open).length,
    degraded: items.filter((i) => i.status !== 'connected' || i.circuit_open).length,
    openCircuits: items.filter((i) => i.circuit_open).length,
  }
  res.json({ summary, items })
}

async function recoverIntegrationCircuit(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  if (!companyId) return res.status(404).json({ message: 'Company not found' })
  const { id } = req.params
  const updated = await query(
    `UPDATE integration_connections
     SET status = 'connected', failed_attempts = 0, circuit_open_until = NULL, last_error = NULL
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [id, companyId]
  )
  if (!updated.rows.length) return res.status(404).json({ message: 'Integration not found' })
  res.json({ message: 'Integration circuit recovered', integration: updated.rows[0] })
}

async function getComplianceFrameworks(req, res) {
  const result = await query('SELECT * FROM compliance_frameworks ORDER BY region_key ASC')
  res.json(result.rows)
}

async function setCompanyRegion(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { region_key = 'global', timezone = 'UTC', locale = 'en' } = req.body
  const result = await query(
    `INSERT INTO company_region_settings (company_id, region_key, timezone, locale, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (company_id) DO UPDATE SET region_key = EXCLUDED.region_key, timezone = EXCLUDED.timezone, locale = EXCLUDED.locale, updated_at = NOW()
     RETURNING *`,
    [companyId, region_key, timezone, locale]
  )
  res.json(result.rows[0])
}

async function getRegionalReport(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const region = req.params.region
  const framework = await query('SELECT * FROM compliance_frameworks WHERE region_key = $1 LIMIT 1', [region])
  const totals = await query(
    `SELECT
      COALESCE(SUM(e.total_co2),0) AS total,
      COALESCE(SUM(e.scope1_co2),0) AS scope1,
      COALESCE(SUM(e.scope2_co2),0) AS scope2,
      COALESCE(SUM(e.scope3_co2),0) AS scope3
     FROM emissions e JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [companyId]
  )
  res.json({
    region,
    framework: framework.rows[0] || null,
    totals: totals.rows[0],
    generatedAt: new Date().toISOString(),
  })
}

async function listCreditListings(req, res) {
  const result = await query('SELECT * FROM carbon_credit_listings WHERE status = $1 ORDER BY created_at DESC', ['active'])
  res.json(result.rows)
}

async function createCreditListing(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { project_name, region_key = 'global', price_per_credit, available_credits } = req.body
  const result = await query(
    `INSERT INTO carbon_credit_listings (seller_company_id, project_name, region_key, price_per_credit, available_credits)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [companyId, project_name, region_key, price_per_credit, available_credits]
  )
  res.status(201).json(result.rows[0])
}

async function buyCredits(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { listingId } = req.params
  const { credits } = req.body
  const listingRes = await query('SELECT * FROM carbon_credit_listings WHERE id = $1 AND status = $2 LIMIT 1', [listingId, 'active'])
  if (!listingRes.rows.length) return res.status(404).json({ message: 'Listing not found' })
  const listing = listingRes.rows[0]
  const qty = Number(credits || 0)
  if (qty <= 0 || qty > Number(listing.available_credits)) return res.status(400).json({ message: 'Invalid credit quantity' })
  const grossTotal = qty * Number(listing.price_per_credit)
  const commissionPct = Number(process.env.MARKETPLACE_COMMISSION_PCT || 2.5)
  const commissionAmount = Number((grossTotal * commissionPct / 100).toFixed(2))
  const total = Number((grossTotal + commissionAmount).toFixed(2))
  const tx = await query(
    `INSERT INTO carbon_credit_transactions (listing_id, buyer_company_id, seller_company_id, credits, unit_price, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [listingId, companyId, listing.seller_company_id, qty, listing.price_per_credit, total]
  )
  await query(
    `UPDATE carbon_credit_listings SET available_credits = available_credits - $1,
      status = CASE WHEN available_credits - $1 <= 0 THEN 'closed' ELSE status END
      WHERE id = $2`,
    [qty, listingId]
  )
  await query(
    `INSERT INTO usage_metering (company_id, metric_key, quantity, period_key)
     VALUES ($1,'marketplace_commission',$2,$3)`,
    [companyId, commissionAmount, monthKey()]
  )
  res.status(201).json({ ...tx.rows[0], gross_total: grossTotal, commission_pct: commissionPct, commission_amount: commissionAmount })
}

async function listApiKeys(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const result = await query(
    `SELECT id, name, key_prefix, scopes, status, created_at, last_used_at
     FROM api_keys WHERE company_id = $1 ORDER BY created_at DESC`,
    [companyId]
  )
  res.json(result.rows)
}

async function createApiKey(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { name, scopes = ['read:health', 'read:emissions', 'read:suppliers'] } = req.body
  const raw = `cf_${crypto.randomBytes(18).toString('hex')}`
  const keyHash = hashKey(raw)
  const prefix = raw.slice(0, 10)
  const result = await query(
    `INSERT INTO api_keys (company_id, name, api_key_hash, key_prefix, scopes)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, name, key_prefix, scopes, status, created_at`,
    [companyId, name || 'API Key', keyHash, prefix, JSON.stringify(scopes)]
  )
  res.status(201).json({ ...result.rows[0], raw_key: raw })
}

async function revokeApiKey(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const result = await query(
    `UPDATE api_keys SET status = 'revoked'
     WHERE id = $1 AND company_id = $2 RETURNING id`,
    [req.params.id, companyId]
  )
  if (!result.rows.length) return res.status(404).json({ message: 'API key not found' })
  res.json({ message: 'Revoked' })
}

async function getPublicApiDocs(req, res) {
  res.json({
    name: 'CarbonFlow Public API',
    version: 'v1',
    auth: 'x-api-key header',
    scopes: ['read:health', 'read:emissions', 'read:suppliers'],
    rateLimit: {
      window: '60s',
      defaultLimit: Number(process.env.PUBLIC_API_RATE_LIMIT || 120),
      headers: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    },
    endpoints: [
      { method: 'GET', path: '/api/public/v1/health' },
      { method: 'GET', path: '/api/public/v1/emissions/summary?period=YYYY-MM' },
      { method: 'GET', path: '/api/public/v1/suppliers?limit=200&offset=0' },
    ],
  })
}

async function getEnterpriseAnalytics(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const from = req.query.from || `${new Date().getFullYear()}-01`
  const to = req.query.to || monthKey()
  const cacheKey = getAnalyticsCacheKey(companyId, from, to)
  const cached = await getCachedAnalytics(cacheKey)
  if (cached) return res.json(cached)
  const summary = await query(
    `SELECT
      COUNT(DISTINCT s.id) AS suppliers,
      COALESCE(SUM(e.total_co2),0) AS total_co2,
      COALESCE(AVG(e.total_co2),0) AS avg_submission_co2
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1`,
    [companyId]
  )
  const usage = await query(
    `SELECT metric_key, COALESCE(SUM(quantity),0) AS qty
     FROM usage_metering
     WHERE company_id = $1 AND period_key >= $2 AND period_key <= $3
     GROUP BY metric_key ORDER BY metric_key`,
    [companyId, from, to]
  )
  const rows = usage.rows
  const csv = ['metric,quantity'].concat(rows.map((r) => `${r.metric_key},${r.qty}`)).join('\n')
  const benchmark = await query(
    `SELECT metric_key, avg_value, unit
     FROM industry_benchmarks
     WHERE industry_key = (
      SELECT COALESCE(industry_key, 'general')
      FROM companies
      WHERE id = $1
      LIMIT 1
     )`,
    [companyId]
  )
  const totalCo2 = Number(summary.rows[0]?.total_co2 || 0)
  const forecast = Array.from({ length: 6 }).map((_, idx) => {
    const monthOffset = idx + 1
    const trendFactor = 0.985 ** monthOffset
    return {
      monthOffset,
      projected_total_co2: Number((totalCo2 * trendFactor).toFixed(2)),
    }
  })
  const payload = { summary: summary.rows[0], usage: rows, benchmark: benchmark.rows, forecast, exports: { csv } }
  await setCachedAnalytics(cacheKey, payload)
  res.json(payload)
}

async function getAuditLogs(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const result = await query(
    `SELECT id, action, entity_type, entity_id, details, performed_by, created_at
     FROM audit_log WHERE company_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [companyId]
  )
  res.json(result.rows)
}

async function getSecurityOverview(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const [keys, usage] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM api_keys WHERE company_id = $1 AND status = $2', [companyId, 'active']),
    query(
      `SELECT endpoint, method, status_code, created_at
       FROM api_usage_logs l
       JOIN api_keys k ON k.id = l.api_key_id
       WHERE k.company_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [companyId]
    ),
  ])
  res.json({
    activeApiKeys: keys.rows[0]?.count || 0,
    recentApiAccess: usage.rows,
    encryption: { atRest: true, inTransit: true, note: 'TLS + hashed API keys' },
  })
}

const PERMISSION_CATALOG = [
  'enterprise.integrations.read',
  'enterprise.integrations.write',
  'enterprise.integrations.sync',
  'enterprise.compliance.read',
  'enterprise.compliance.write',
  'enterprise.marketplace.read',
  'enterprise.marketplace.write',
  'enterprise.marketplace.buy',
  'enterprise.api.read',
  'enterprise.api.write',
  'enterprise.api.revoke',
  'enterprise.analytics.read',
  'enterprise.security.read',
  'enterprise.security.permissions.read',
  'enterprise.security.permissions.write',
  'enterprise.billing.read',
  'enterprise.billing.write',
  'enterprise.ai.read',
  'enterprise.ai.write',
  'enterprise.global.read',
  'enterprise.global.write',
]

const PERMISSION_TEMPLATES = [
  {
    key: 'compliance_manager',
    name: 'Compliance Manager',
    permissions: [
      'enterprise.compliance.read',
      'enterprise.compliance.write',
      'enterprise.analytics.read',
      'enterprise.ai.read',
      'enterprise.global.read',
      'enterprise.security.read',
    ],
  },
  {
    key: 'finance_admin',
    name: 'Finance Admin',
    permissions: [
      'enterprise.billing.read',
      'enterprise.billing.write',
      'enterprise.marketplace.read',
      'enterprise.marketplace.buy',
      'enterprise.analytics.read',
      'enterprise.api.read',
    ],
  },
  {
    key: 'ops_analyst',
    name: 'Ops Analyst',
    permissions: [
      'enterprise.integrations.read',
      'enterprise.integrations.sync',
      'enterprise.marketplace.read',
      'enterprise.analytics.read',
      'enterprise.ai.read',
      'enterprise.global.read',
    ],
  },
]

async function getPermissionCatalog(req, res) {
  res.json(PERMISSION_CATALOG)
}

async function getPermissionTemplates(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const custom = await query(
    `SELECT id, template_key AS key, name, permissions, is_system, created_at, updated_at
     FROM permission_templates
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  )
  const systemTemplates = PERMISSION_TEMPLATES.map((t) => ({ ...t, is_system: true }))
  res.json(systemTemplates.concat(custom.rows))
}

async function resolveTemplateForCompany(companyId, templateKey) {
  let template = PERMISSION_TEMPLATES.find((t) => t.key === templateKey) || null
  if (template) return template
  const customTemplate = await query(
    `SELECT template_key AS key, name, permissions
     FROM permission_templates
     WHERE company_id = $1 AND template_key = $2
     LIMIT 1`,
    [companyId, templateKey]
  )
  return customTemplate.rows[0] || null
}

async function exportPermissionTemplates(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const custom = await query(
    `SELECT template_key AS key, name, permissions, updated_at
     FROM permission_templates
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [companyId]
  )
  res.json({
    version: 1,
    exported_at: new Date().toISOString(),
    templates: custom.rows,
  })
}

async function importPermissionTemplates(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const incoming = Array.isArray(req.body?.templates) ? req.body.templates : []
  if (!incoming.length) return res.status(400).json({ message: 'No templates provided' })
  let imported = 0
  for (const t of incoming) {
    const name = String(t.name || '').trim()
    const templateKey = String(t.key || '').trim()
    if (!name || !templateKey) continue
    const permissions = Array.from(new Set((t.permissions || []).filter((p) => PERMISSION_CATALOG.includes(p))))
    await query(
      `INSERT INTO permission_templates (company_id, template_key, name, permissions, is_system, updated_at)
       VALUES ($1,$2,$3,$4,false,NOW())
       ON CONFLICT (company_id, template_key)
       DO UPDATE SET name = EXCLUDED.name, permissions = EXCLUDED.permissions, updated_at = NOW()`,
      [companyId, templateKey, name, JSON.stringify(permissions)]
    )
    imported += 1
  }
  res.json({ message: 'Templates imported', imported })
}

async function getCompanyPermissionUsers(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const users = await query(
    `SELECT DISTINCT u.id, u.email, u.display_name
     FROM user_roles ur
     JOIN users u ON u.id = ur.user_id
     WHERE ur.company_id = $1 AND ur.role = 'company'
     ORDER BY u.email ASC`,
    [companyId]
  )
  const overrides = await query(
    `SELECT up.user_id, up.permission_key, up.granted
     FROM user_permissions up
     WHERE up.user_id IN (
      SELECT user_id FROM user_roles WHERE company_id = $1 AND role = 'company'
     )`,
    [companyId]
  )
  const byUser = new Map()
  for (const row of overrides.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
    byUser.get(row.user_id).push({ permission_key: row.permission_key, granted: row.granted })
  }
  res.json(
    users.rows.map((u) => ({
      ...u,
      overrides: byUser.get(u.id) || [],
    }))
  )
}

async function upsertUserPermission(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { userId } = req.params
  const { permission_key, granted = true } = req.body || {}
  if (!permission_key || !PERMISSION_CATALOG.includes(permission_key)) {
    return res.status(400).json({ message: 'Invalid permission_key' })
  }
  const hasRole = await query(
    `SELECT 1
     FROM user_roles
     WHERE user_id = $1 AND company_id = $2 AND role = 'company'
     LIMIT 1`,
    [userId, companyId]
  )
  if (!hasRole.rows.length) return res.status(404).json({ message: 'User not found in company' })
  const result = await query(
    `INSERT INTO user_permissions (user_id, permission_key, granted)
     VALUES ($1,$2,$3)
     ON CONFLICT (user_id, permission_key)
     DO UPDATE SET granted = EXCLUDED.granted
     RETURNING *`,
    [userId, permission_key, !!granted]
  )
  res.json(result.rows[0])
}

async function applyPermissionTemplate(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { userId } = req.params
  const { template_key } = req.body || {}
  let template = await resolveTemplateForCompany(companyId, template_key)
  if (!template) return res.status(400).json({ message: 'Invalid template_key' })
  const hasRole = await query(
    `SELECT 1
     FROM user_roles
     WHERE user_id = $1 AND company_id = $2 AND role = 'company'
     LIMIT 1`,
    [userId, companyId]
  )
  if (!hasRole.rows.length) return res.status(404).json({ message: 'User not found in company' })

  const included = new Set(template.permissions)
  await Promise.all(
    PERMISSION_CATALOG.map((permissionKey) =>
      query(
        `INSERT INTO user_permissions (user_id, permission_key, granted)
         VALUES ($1,$2,$3)
         ON CONFLICT (user_id, permission_key)
         DO UPDATE SET granted = EXCLUDED.granted`,
        [userId, permissionKey, included.has(permissionKey)]
      )
    )
  )
  res.json({ message: 'Template applied', template: template.key, userId })
}

async function getTemplateDiffForUser(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { userId } = req.params
  const { template_key } = req.body || {}
  const template = await resolveTemplateForCompany(companyId, template_key)
  if (!template) return res.status(400).json({ message: 'Invalid template_key' })
  const hasRole = await query(
    `SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND role = 'company' LIMIT 1`,
    [userId, companyId]
  )
  if (!hasRole.rows.length) return res.status(404).json({ message: 'User not found in company' })
  const currentOverrides = await query(
    `SELECT permission_key, granted
     FROM user_permissions
     WHERE user_id = $1`,
    [userId]
  )
  const currentGranted = new Set(currentOverrides.rows.filter((r) => !!r.granted).map((r) => r.permission_key))
  const targetGranted = new Set((template.permissions || []).filter((p) => PERMISSION_CATALOG.includes(p)))
  const toGrant = []
  const toRevoke = []
  for (const p of PERMISSION_CATALOG) {
    const hasCurrent = currentGranted.has(p)
    const shouldHave = targetGranted.has(p)
    if (!hasCurrent && shouldHave) toGrant.push(p)
    if (hasCurrent && !shouldHave) toRevoke.push(p)
  }
  res.json({ template_key, user_id: userId, toGrant, toRevoke })
}

async function bulkApplyPermissionTemplate(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { template_key, user_ids = [] } = req.body || {}
  const ids = Array.isArray(user_ids) ? user_ids : []
  if (!ids.length) return res.status(400).json({ message: 'user_ids is required' })
  const template = await resolveTemplateForCompany(companyId, template_key)
  if (!template) return res.status(400).json({ message: 'Invalid template_key' })
  const included = new Set(template.permissions || [])
  let updatedUsers = 0
  for (const userId of ids) {
    const hasRole = await query(
      `SELECT 1 FROM user_roles WHERE user_id = $1 AND company_id = $2 AND role = 'company' LIMIT 1`,
      [userId, companyId]
    )
    if (!hasRole.rows.length) continue
    await Promise.all(
      PERMISSION_CATALOG.map((permissionKey) =>
        query(
          `INSERT INTO user_permissions (user_id, permission_key, granted)
           VALUES ($1,$2,$3)
           ON CONFLICT (user_id, permission_key)
           DO UPDATE SET granted = EXCLUDED.granted`,
          [userId, permissionKey, included.has(permissionKey)]
        )
      )
    )
    updatedUsers += 1
  }
  res.json({ message: 'Bulk template applied', template: template.key, updatedUsers })
}

async function createPermissionTemplate(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { name, permissions = [] } = req.body || {}
  if (!name || String(name).trim().length < 3) return res.status(400).json({ message: 'Template name is required' })
  const sanitized = Array.from(new Set((permissions || []).filter((p) => PERMISSION_CATALOG.includes(p))))
  const templateKey = `custom_${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`
  const result = await query(
    `INSERT INTO permission_templates (company_id, template_key, name, permissions, is_system)
     VALUES ($1,$2,$3,$4,false)
     RETURNING id, template_key AS key, name, permissions, is_system, created_at, updated_at`,
    [companyId, templateKey, String(name).trim(), JSON.stringify(sanitized)]
  )
  res.status(201).json(result.rows[0])
}

async function updatePermissionTemplate(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { templateId } = req.params
  const { name, permissions } = req.body || {}
  const updates = []
  const values = []
  let idx = 1
  if (name !== undefined) {
    updates.push(`name = $${idx++}`)
    values.push(String(name).trim())
  }
  if (permissions !== undefined) {
    const sanitized = Array.from(new Set((permissions || []).filter((p) => PERMISSION_CATALOG.includes(p))))
    updates.push(`permissions = $${idx++}`)
    values.push(JSON.stringify(sanitized))
  }
  if (!updates.length) return res.status(400).json({ message: 'No updates provided' })
  updates.push('updated_at = NOW()')
  values.push(templateId, companyId)
  const result = await query(
    `UPDATE permission_templates
     SET ${updates.join(', ')}
     WHERE id = $${idx++} AND company_id = $${idx++} AND is_system = false
     RETURNING id, template_key AS key, name, permissions, is_system, created_at, updated_at`,
    values
  )
  if (!result.rows.length) return res.status(404).json({ message: 'Template not found' })
  res.json(result.rows[0])
}

async function deletePermissionTemplate(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { templateId } = req.params
  const result = await query(
    `DELETE FROM permission_templates
     WHERE id = $1 AND company_id = $2 AND is_system = false
     RETURNING id`,
    [templateId, companyId]
  )
  if (!result.rows.length) return res.status(404).json({ message: 'Template not found' })
  res.json({ message: 'Template deleted' })
}

async function getPlans(req, res) {
  const plans = await query('SELECT * FROM subscription_plans ORDER BY monthly_price ASC')
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const current = companyId
    ? await query(
      `SELECT cs.*, sp.plan_key, sp.name, sp.monthly_price
       FROM company_subscriptions cs
       JOIN subscription_plans sp ON sp.id = cs.plan_id
       WHERE cs.company_id = $1 LIMIT 1`,
      [companyId]
    )
    : { rows: [] }
  res.json({ plans: plans.rows, current: current.rows[0] || null })
}

async function subscribePlan(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const plan = await query('SELECT id FROM subscription_plans WHERE plan_key = $1 LIMIT 1', [req.body.plan_key])
  if (!plan.rows.length) return res.status(404).json({ message: 'Plan not found' })
  const renewal = new Date()
  renewal.setMonth(renewal.getMonth() + 1)
  const result = await query(
    `INSERT INTO company_subscriptions (company_id, plan_id, status, renewal_at)
     VALUES ($1,$2,'active',$3)
     ON CONFLICT (company_id) DO UPDATE SET plan_id = EXCLUDED.plan_id, status = 'active', renewal_at = EXCLUDED.renewal_at
     RETURNING *`,
    [companyId, plan.rows[0].id, renewal.toISOString()]
  )
  res.json(result.rows[0])
}

async function getBillingInvoices(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const usage = await query(
    `SELECT metric_key, COALESCE(SUM(quantity),0) AS qty
     FROM usage_metering
     WHERE company_id = $1 AND period_key = $2
     GROUP BY metric_key`,
    [companyId, monthKey()]
  )
  const subscription = await query(
    `SELECT sp.name, sp.monthly_price, sp.included_api_calls
     FROM company_subscriptions cs
     JOIN subscription_plans sp ON sp.id = cs.plan_id
     WHERE cs.company_id = $1
     LIMIT 1`,
    [companyId]
  )
  const base = Number(subscription.rows[0]?.monthly_price || 0)
  const includedApiCalls = Number(subscription.rows[0]?.included_api_calls || 0)
  const apiCalls = Number(usage.rows.find((u) => u.metric_key === 'public_api_call')?.qty || 0)
  const overageCalls = Math.max(0, apiCalls - includedApiCalls)
  const usageCharge = Number((overageCalls * 0.0025).toFixed(2))
  const marketplaceCommission = Number(usage.rows.find((u) => u.metric_key === 'marketplace_commission')?.qty || 0)
  const totalDue = Number((base + usageCharge + marketplaceCommission).toFixed(2))
  res.json({
    period: monthKey(),
    plan: subscription.rows[0] || null,
    usage: usage.rows,
    invoicePreview: {
      currency: 'USD',
      base,
      usageCharge,
      totalDue,
      lineItems: [
        { label: 'Subscription', amount: base },
        { label: 'API Overage', units: overageCalls, unitPrice: 0.0025, amount: usageCharge },
        { label: 'Marketplace Commissions', amount: marketplaceCommission },
      ],
    },
  })
}

async function getGlobalSettings(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const result = await query(
    `SELECT region_key, timezone, locale, compliance_mode, carbon_price_inr_per_ton, updated_at
     FROM company_region_settings
     WHERE company_id = $1
     LIMIT 1`,
    [companyId]
  )
  res.json(result.rows[0] || { region_key: 'global', timezone: 'UTC', locale: 'en', compliance_mode: 'standard', carbon_price_inr_per_ton: 2500 })
}

async function upsertGlobalSettings(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const { region_key = 'global', timezone = 'UTC', locale = 'en', compliance_mode = 'standard', carbon_price_inr_per_ton = 2500 } = req.body || {}
  const result = await query(
    `INSERT INTO company_region_settings (company_id, region_key, timezone, locale, compliance_mode, carbon_price_inr_per_ton, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW())
     ON CONFLICT (company_id) DO UPDATE
       SET region_key = EXCLUDED.region_key,
           timezone = EXCLUDED.timezone,
           locale = EXCLUDED.locale,
           compliance_mode = EXCLUDED.compliance_mode,
           carbon_price_inr_per_ton = EXCLUDED.carbon_price_inr_per_ton,
           updated_at = NOW()
     RETURNING *`,
    [companyId, region_key, timezone, locale, compliance_mode, carbon_price_inr_per_ton]
  )
  res.json(result.rows[0])
}

async function getAiAnomalies(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const rows = await query(
    `SELECT e.total_co2, e.created_at, s.name AS supplier_name
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1
     ORDER BY e.created_at DESC
     LIMIT 60`,
    [companyId]
  )
  const values = rows.rows.map((r) => Number(r.total_co2 || 0))
  if (!values.length) return res.json({ anomalies: [], baseline: null })
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + ((b - mean) ** 2), 0) / Math.max(values.length, 1)
  const stdDev = Math.sqrt(variance)
  const threshold = mean + (2 * stdDev)
  const anomalies = rows.rows
    .filter((r) => Number(r.total_co2 || 0) > threshold)
    .map((r) => ({
      supplier: r.supplier_name,
      total_co2: Number(r.total_co2 || 0),
      created_at: r.created_at,
      reason: 'Emission spike above 2σ threshold',
    }))
  res.json({
    baseline: { mean: Number(mean.toFixed(2)), stdDev: Number(stdDev.toFixed(2)), threshold: Number(threshold.toFixed(2)) },
    anomalies,
  })
}

async function aiSummary(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const payload = req.body?.payload || {}
  const summary = await generateSummary({ companyId, ...payload })
  await query(
    `INSERT INTO usage_metering (company_id, metric_key, quantity, period_key)
     VALUES ($1,'ai_requests',1,$2)`,
    [companyId, monthKey()]
  )
  res.json(summary)
}

async function aiQuery(req, res) {
  const { companyId } = await resolveCompanyContext(req.uid, req.email)
  const question = String(req.body?.question || '').trim()
  if (!question) return res.status(400).json({ message: 'question is required' })
  const analytics = await query(
    `SELECT
      COUNT(DISTINCT s.id) AS suppliers,
      COALESCE(SUM(e.total_co2),0) AS total_co2,
      COALESCE(AVG(e.total_co2),0) AS avg_submission_co2
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1`,
    [companyId]
  )
  const response = await generateQueryAnswer({
    question,
    data: analytics.rows[0] || {},
  })
  await query(
    `INSERT INTO usage_metering (company_id, metric_key, quantity, period_key)
     VALUES ($1,'ai_queries',1,$2)`,
    [companyId, monthKey()]
  )
  res.json(response)
}

module.exports = {
  getIntegrationConnections,
  getIntegrationProviders,
  createIntegrationConnection,
  triggerIntegrationSync,
  getIntegrationHealth,
  recoverIntegrationCircuit,
  getComplianceFrameworks,
  setCompanyRegion,
  getRegionalReport,
  listCreditListings,
  createCreditListing,
  buyCredits,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getPublicApiDocs,
  getEnterpriseAnalytics,
  getAuditLogs,
  getSecurityOverview,
  getPermissionCatalog,
  getPermissionTemplates,
  exportPermissionTemplates,
  importPermissionTemplates,
  createPermissionTemplate,
  updatePermissionTemplate,
  deletePermissionTemplate,
  getCompanyPermissionUsers,
  upsertUserPermission,
  getTemplateDiffForUser,
  applyPermissionTemplate,
  bulkApplyPermissionTemplate,
  getPlans,
  subscribePlan,
  getBillingInvoices,
  getGlobalSettings,
  upsertGlobalSettings,
  getAiAnomalies,
  aiSummary,
  aiQuery,
}
