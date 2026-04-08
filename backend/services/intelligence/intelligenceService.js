const { query } = require('../../models/db')
const { buildPeriodComparison } = require('./periodComparisonEngine')
const { sendAlertEmail } = require('../emailService')
const { intelligenceEngines } = require('./engineRegistry')

const CACHE_TTL_MS = 60 * 1000
const CHAT_WINDOW = 8
const overviewCache = new Map()

function getCacheKey(companyId) {
  return `overview:${companyId}`
}

function getCachedOverview(companyId) {
  const key = getCacheKey(companyId)
  const cached = overviewCache.get(key)
  if (!cached || cached.expiresAt < Date.now()) return null
  return cached.value
}

function setCachedOverview(companyId, value) {
  overviewCache.set(getCacheKey(companyId), { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

function clearCachedOverview(companyId) {
  overviewCache.delete(getCacheKey(companyId))
}

async function resolveCompany(uid, email) {
  let result = await query('SELECT * FROM companies WHERE firebase_uid = $1', [uid])
  if (result.rows.length) return result.rows[0]
  if (!email) return null

  result = await query('SELECT * FROM companies WHERE LOWER(email) = LOWER($1)', [email])
  if (result.rows.length) {
    const relinked = await query('UPDATE companies SET firebase_uid = $1 WHERE id = $2 RETURNING *', [uid, result.rows[0].id])
    return relinked.rows[0]
  }

  const defaultName = email.split('@')[0] || 'My Company'
  const created = await query(
    'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING *',
    [defaultName, email, uid]
  )
  return created.rows[0]
}

async function getTopSupplierTotals(companyId) {
  const result = await query(
    `SELECT s.id, s.name, s.status,
            COALESCE(SUM(e.total_co2), 0) AS total_co2
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1
     GROUP BY s.id, s.name, s.status
     ORDER BY total_co2 DESC`,
    [companyId]
  )
  return result.rows
}

async function getMonthlyTotals(companyId, limitMonths = 12) {
  const result = await query(
    `WITH monthly AS (
      SELECT DATE_TRUNC('month', e.created_at) AS month_date, COALESCE(SUM(e.total_co2),0) AS total
      FROM emissions e
      JOIN suppliers s ON s.id = e.supplier_id
      WHERE s.company_id = $1
      GROUP BY DATE_TRUNC('month', e.created_at)
      UNION ALL
      SELECT DATE_TRUNC('month', d.created_at) AS month_date, COALESCE(SUM(d.total_co2),0) AS total
      FROM company_direct_emissions d
      WHERE d.company_id = $1
      GROUP BY DATE_TRUNC('month', d.created_at)
    )
    SELECT TO_CHAR(month_date, 'YYYY-MM') AS month, COALESCE(SUM(total),0) AS total
    FROM monthly
    GROUP BY month_date
    ORDER BY month_date DESC
    LIMIT $2`,
    [companyId, limitMonths]
  )
  return result.rows.reverse()
}

async function getPendingStats(companyId) {
  const result = await query(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
      COUNT(*) FILTER (WHERE status = 'pending' AND created_at < NOW() - INTERVAL '5 days') AS overdue_count
     FROM suppliers
     WHERE company_id = $1`,
    [companyId]
  )
  const row = result.rows[0] || {}
  return {
    pendingCount: Number(row.pending_count || 0),
    overdueCount: Number(row.overdue_count || 0),
  }
}

async function getSupplierDelayPatterns(companyId) {
  const result = await query(
    `SELECT s.id, s.name, COUNT(r.id)::int AS reminder_count
     FROM suppliers s
     LEFT JOIN supplier_reminders r ON r.supplier_id = s.id
     WHERE s.company_id = $1
       AND s.status = 'pending'
       AND s.created_at < NOW() - INTERVAL '5 days'
     GROUP BY s.id, s.name
     ORDER BY reminder_count DESC`,
    [companyId]
  )
  const repeatedDelays = result.rows.filter((r) => Number(r.reminder_count || 0) >= 2)
  return {
    overdueWithReminders: result.rows,
    repeatedDelays,
  }
}

/**
 * Source shares in kg CO₂e (comparable): Scope 1 → fuel activity bucket, Scope 2 → electricity,
 * Scope 3 → transport-led bucket (aligns with supplier/direct/shared stored scope columns).
 */
async function getSourceBreakdown(companyId) {
  const supplierRes = await query(
    `SELECT
      COALESCE(SUM(e.scope1_co2),0) AS scope1_co2,
      COALESCE(SUM(e.scope2_co2),0) AS scope2_co2,
      COALESCE(SUM(e.scope3_co2),0) AS scope3_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [companyId]
  )
  const directRes = await query(
    `SELECT
      COALESCE(SUM(scope1_co2),0) AS scope1_co2,
      COALESCE(SUM(scope2_co2),0) AS scope2_co2
     FROM company_direct_emissions
     WHERE company_id = $1`,
    [companyId]
  )
  const sharedRes = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END),0) AS scope1_co2,
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END),0) AS scope2_co2,
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END),0) AS scope3_co2
     FROM company_supplier_links l
     JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
     WHERE l.company_id = $1`,
    [companyId]
  )

  const fuelKg =
    Number(supplierRes.rows[0].scope1_co2 || 0) +
    Number(directRes.rows[0].scope1_co2 || 0) +
    Number(sharedRes.rows[0].scope1_co2 || 0)
  const electricityKg =
    Number(supplierRes.rows[0].scope2_co2 || 0) +
    Number(directRes.rows[0].scope2_co2 || 0) +
    Number(sharedRes.rows[0].scope2_co2 || 0)
  const transportKg =
    Number(supplierRes.rows[0].scope3_co2 || 0) + Number(sharedRes.rows[0].scope3_co2 || 0)

  const totalKg = fuelKg + electricityKg + transportKg
  const denom = totalKg > 0 ? totalKg : 1

  const rows = [
    { key: 'fuel', label: 'Fuel', value: fuelKg, share: (fuelKg / denom) * 100 },
    { key: 'electricity', label: 'Electricity', value: electricityKg, share: (electricityKg / denom) * 100 },
    { key: 'transport', label: 'Transport', value: transportKg, share: (transportKg / denom) * 100 },
  ]
  return rows.map((r) => ({
    ...r,
    value: Number(Number(r.value).toFixed(4)),
    share: Number(Number(r.share).toFixed(2)),
  }))
}

async function getBenchmarks(industryKey) {
  const result = await query(
    `SELECT metric_key, avg_value, unit
     FROM industry_benchmarks
     WHERE industry_key = $1 OR industry_key = 'general'`,
    [industryKey || 'general']
  )
  return result.rows
}

async function persistSupplierScores(companyId, scores) {
  await query('DELETE FROM supplier_scores WHERE company_id = $1', [companyId])
  for (const score of scores) {
    await query(
      `INSERT INTO supplier_scores (company_id, supplier_id, score, tier, factors)
       VALUES ($1,$2,$3,$4,$5)`,
      [companyId, score.supplierId, score.score, score.tier, JSON.stringify(score.factors)]
    )
  }
}

async function persistAlerts(company, alerts) {
  if (!alerts.length) return
  const persisted = []
  for (const alert of alerts) {
    const duplicateCheck = await query(
      `SELECT id
       FROM intelligence_alerts
       WHERE company_id = $1
         AND type = $2
         AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [company.id, alert.type]
    )
    if (duplicateCheck.rows.length) {
      continue
    }

    const payload = { ...(alert.payload || {}), reasoning: alert.reasoning || '' }
    const inserted = await query(
      `INSERT INTO intelligence_alerts (company_id, type, severity, message, payload)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, company_id, type, severity, message, payload, status, created_at, acknowledged_at`,
      [company.id, alert.type, alert.severity, alert.message, JSON.stringify(payload)]
    )

    const row = inserted.rows[0]
    persisted.push({
      id: row.id,
      type: row.type,
      severity: row.severity,
      message: row.message,
      status: row.status,
      payload: row.payload,
      reasoning: row.payload?.reasoning || '',
      created_at: row.created_at,
      acknowledged_at: row.acknowledged_at,
    })

    if (alert.severity === 'critical') {
      await sendAlertEmail(company.email, company.name, alert.message)
    }
  }
  return persisted
}

async function buildOverview(company) {
  const [topSuppliers, monthlyTotals, sourceBreakdown, pendingStats, delayPatterns] = await Promise.all([
    getTopSupplierTotals(company.id),
    getMonthlyTotals(company.id, 12),
    getSourceBreakdown(company.id),
    getPendingStats(company.id),
    getSupplierDelayPatterns(company.id),
  ])

  const supplierScores = intelligenceEngines.scoring(topSuppliers)
  const alerts = intelligenceEngines.alerts({
    monthlyTotals,
    pendingSuppliers: pendingStats,
    supplierTotals: topSuppliers,
    delayPatterns,
  })
  const insights = intelligenceEngines.insights({ topSuppliers, sourceBreakdown, monthlyTotals })
  const recommendations = intelligenceEngines.recommendations({ sourceBreakdown, alerts, supplierScores })
  const forecast = intelligenceEngines.forecast(monthlyTotals)
  const benchmarks = await getBenchmarks(company.industry_key)
  const benchmarkComparison = intelligenceEngines.benchmark({
    companyIndustry: company.industry_key,
    benchmarks,
    monthlyTotals,
    supplierScores,
  })

  const [_, persistedAlerts] = await Promise.all([
    persistSupplierScores(company.id, supplierScores),
    persistAlerts(company, alerts),
  ])

  const effectiveAlerts = persistedAlerts?.length
    ? persistedAlerts
    : alerts.map((alert) => ({
      ...alert,
      reasoning: alert.reasoning || '',
    }))

  return {
    generatedAt: new Date().toISOString(),
    insights,
    alerts: effectiveAlerts,
    recommendations,
    forecast,
    supplierScores,
    benchmark: benchmarkComparison,
    sourceBreakdown,
    monthlyTotals,
    pendingStats,
    delayPatterns,
  }
}

async function getOverview(uid, email, forceRefresh = false) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  if (!forceRefresh) {
    const cached = getCachedOverview(company.id)
    if (cached) return cached
  }
  const overview = await buildOverview(company)
  setCachedOverview(company.id, overview)
  return overview
}

async function getAlerts(uid, email, status = 'open') {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  const params = [company.id]
  let where = 'company_id = $1'
  if (status !== 'all') {
    params.push(status)
    where += ` AND status = $${params.length}`
  }
  const result = await query(
    `SELECT id, type, severity, message, status, payload, created_at, acknowledged_at
     FROM intelligence_alerts
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT 200`,
    params
  )
  return result.rows.map((row) => ({
    ...row,
    reasoning: row.payload?.reasoning || '',
  }))
}

async function acknowledgeAlert(uid, email, alertId) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  const result = await query(
    `UPDATE intelligence_alerts
     SET status = 'acknowledged', acknowledged_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [alertId, company.id]
  )
  if (!result.rows.length) throw new Error('Alert not found')
  clearCachedOverview(company.id)
  return result.rows[0]
}

async function getSupplierScores(uid, email) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  const result = await query(
    `SELECT ss.supplier_id, s.name, ss.score, ss.tier, ss.factors, ss.calculated_at
     FROM supplier_scores ss
     JOIN suppliers s ON s.id = ss.supplier_id
     WHERE ss.company_id = $1
     ORDER BY ss.score DESC`,
    [company.id]
  )
  if (!result.rows.length) {
    const overview = await getOverview(uid, email, true)
    return overview.supplierScores
  }
  return result.rows
}

async function getForecast(uid, email) {
  const overview = await getOverview(uid, email)
  return overview.forecast
}

async function getBenchmark(uid, email) {
  const overview = await getOverview(uid, email)
  return overview.benchmark
}

async function getPeriodTotals(companyId, period) {
  const result = await query(
    `WITH p AS (
      SELECT COALESCE(SUM(e.total_co2),0) AS total
      FROM emissions e
      JOIN suppliers s ON s.id = e.supplier_id
      WHERE s.company_id = $1 AND TO_CHAR(e.created_at, 'YYYY-MM') = $2
    ), d AS (
      SELECT COALESCE(SUM(total_co2),0) AS total
      FROM company_direct_emissions
      WHERE company_id = $1 AND TO_CHAR(created_at, 'YYYY-MM') = $2
    )
    SELECT (SELECT total FROM p) + (SELECT total FROM d) AS total`,
    [companyId, period]
  )
  return Number(result.rows[0]?.total || 0)
}

async function getPeriodCompare(uid, email, current, previous) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  const [currentTotal, previousTotal] = await Promise.all([
    getPeriodTotals(company.id, current),
    getPeriodTotals(company.id, previous),
  ])
  return buildPeriodComparison(
    { period: current, total: currentTotal },
    { period: previous, total: previousTotal }
  )
}

async function getRecentChatHistory(companyId, limit = CHAT_WINDOW) {
  const result = await query(
    `SELECT role, content, created_at
     FROM intelligence_chat_messages
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [companyId, limit]
  )
  return result.rows.reverse()
}

async function saveChatMessage(companyId, role, content) {
  await query(
    `INSERT INTO intelligence_chat_messages (company_id, role, content)
     VALUES ($1, $2, $3)`,
    [companyId, role, content]
  )
}

async function chatAssistant(uid, email, question) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  const overview = await getOverview(uid, email)
  const history = await getRecentChatHistory(company.id)
  const reply = intelligenceEngines.assistant(question, {
    topSuppliers: overview.supplierScores || [],
    sourceBreakdown: overview.sourceBreakdown || [],
    monthlyTotals: overview.monthlyTotals || [],
    forecast: overview.forecast || {},
    alerts: overview.alerts || [],
    recommendations: overview.recommendations || [],
    supplierScores: overview.supplierScores || [],
    history,
  })
  await saveChatMessage(company.id, 'user', question)
  await saveChatMessage(company.id, 'assistant', reply.answer)
  const conversationWindow = await getRecentChatHistory(company.id)
  return {
    question,
    answer: reply.answer,
    suggestions: reply.suggestions || [],
    conversationWindow,
    generatedAt: new Date().toISOString(),
  }
}

async function clearAssistantConversation(uid, email) {
  const company = await resolveCompany(uid, email)
  if (!company) throw new Error('Company not found')
  await query('DELETE FROM intelligence_chat_messages WHERE company_id = $1', [company.id])
  return { message: 'Conversation cleared' }
}

module.exports = {
  getOverview,
  getAlerts,
  acknowledgeAlert,
  getSupplierScores,
  getForecast,
  getBenchmark,
  getPeriodCompare,
  chatAssistant,
  clearAssistantConversation,
  clearCachedOverview,
  getSourceBreakdown,
}
