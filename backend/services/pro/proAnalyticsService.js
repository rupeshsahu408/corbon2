const { query } = require('../../models/db')
const { mergeMonthlyTrend } = require('../analytics/mergeMonthlyTrend')
const { getSourceBreakdown } = require('../intelligence/intelligenceService')
const { buildCompanyInsights } = require('./smartInsightsEngine')

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function pct(numer, denom, digits = 2) {
  const d = Number(denom || 0)
  if (d <= 0) return 0
  return Number(((Number(numer || 0) / d) * 100).toFixed(digits))
}

function buildMoMComparison(monthlyTrend = []) {
  if (!Array.isArray(monthlyTrend) || monthlyTrend.length < 2) {
    return {
      available: false,
      currentMonth: null,
      previousMonth: null,
      currentTotalKg: 0,
      previousTotalKg: 0,
      deltaKg: 0,
      deltaPct: 0,
      direction: 'flat',
      message: 'Not enough data for month-over-month comparison.',
    }
  }
  const curr = monthlyTrend[monthlyTrend.length - 1]
  const prev = monthlyTrend[monthlyTrend.length - 2]
  const currentTotal = Number(curr?.co2 || 0)
  const previousTotal = Number(prev?.co2 || 0)
  const deltaKg = currentTotal - previousTotal
  const deltaPct = previousTotal > 0 ? (deltaKg / previousTotal) * 100 : 0
  const direction = deltaKg > 0 ? 'increase' : deltaKg < 0 ? 'decrease' : 'flat'
  const message =
    direction === 'increase'
      ? `Emissions increased by ${round(deltaPct, 1)}% vs last month.`
      : direction === 'decrease'
        ? `Emissions decreased by ${round(Math.abs(deltaPct), 1)}% vs last month.`
        : 'Emissions are flat vs last month.'

  return {
    available: true,
    currentMonth: curr.month,
    previousMonth: prev.month,
    currentTotalKg: round(currentTotal, 4),
    previousTotalKg: round(previousTotal, 4),
    deltaKg: round(deltaKg, 4),
    deltaPct: round(deltaPct, 2),
    direction,
    message,
  }
}

async function getCompanyId(uid, email) {
  let res = await query('SELECT id, name FROM companies WHERE firebase_uid = $1', [uid])
  if (res.rows[0]) return res.rows[0]

  if (!email) return null

  const byEmail = await query('SELECT id, name FROM companies WHERE LOWER(email) = LOWER($1)', [email])
  if (byEmail.rows[0]) {
    const relinked = await query(
      'UPDATE companies SET firebase_uid = $1 WHERE id = $2 RETURNING id, name',
      [uid, byEmail.rows[0].id]
    )
    return relinked.rows[0] || null
  }

  const defaultName = email.split('@')[0] || 'My Company'
  const created = await query(
    'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING id, name',
    [defaultName, email, uid]
  )
  return created.rows[0] || null
}

async function getGrandTotals(companyId) {
  const [supplierRes, sharedRes, directRes] = await Promise.all([
    query(
      `SELECT
        COALESCE(SUM(e.scope1_co2),0) AS scope1,
        COALESCE(SUM(e.scope2_co2),0) AS scope2,
        COALESCE(SUM(e.scope3_co2),0) AS scope3
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT
        COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END),0) AS scope1,
        COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END),0) AS scope2,
        COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END),0) AS scope3
       FROM company_supplier_links l
       JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
       WHERE l.company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT
        COALESCE(SUM(scope1_co2),0) AS scope1,
        COALESCE(SUM(scope2_co2),0) AS scope2
       FROM company_direct_emissions
       WHERE company_id = $1`,
      [companyId]
    ),
  ])

  const supplier = supplierRes.rows[0] || {}
  const shared = sharedRes.rows[0] || {}
  const direct = directRes.rows[0] || {}

  const scope1 = Number(supplier.scope1 || 0) + Number(shared.scope1 || 0) + Number(direct.scope1 || 0)
  const scope2 = Number(supplier.scope2 || 0) + Number(shared.scope2 || 0) + Number(direct.scope2 || 0)
  const scope3 = Number(supplier.scope3 || 0) + Number(shared.scope3 || 0)
  const total = scope1 + scope2 + scope3

  return {
    scope1Kg: round(scope1, 4),
    scope2Kg: round(scope2, 4),
    scope3Kg: round(scope3, 4),
    totalKg: round(total, 4),
  }
}

async function getMonthlyTrend(companyId, months = 12) {
  const [supplierTrendRes, sharedTrendRes, directTrendRes] = await Promise.all([
    query(
      `SELECT
         DATE_TRUNC('month', e.created_at) AS month_date,
         COALESCE(SUM(e.total_co2), 0)   AS total_co2,
         COALESCE(SUM(e.scope1_co2), 0)  AS scope1_co2,
         COALESCE(SUM(e.scope2_co2), 0)  AS scope2_co2,
         COALESCE(SUM(e.scope3_co2), 0)  AS scope3_co2
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1 AND e.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', e.created_at)
       ORDER BY month_date ASC`,
      [companyId]
    ),
    query(
      `SELECT
         TO_DATE(se.period_key || '-01', 'YYYY-MM-DD') AS month_date,
         COALESCE(SUM(CASE WHEN l.share_emissions THEN se.total_co2 ELSE 0 END), 0)   AS total_co2,
         COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END), 0)  AS scope1_co2,
         COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END), 0)  AS scope2_co2,
         COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END), 0)  AS scope3_co2
       FROM company_supplier_links l
       JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
       WHERE l.company_id = $1
       GROUP BY se.period_key
       ORDER BY month_date ASC`,
      [companyId]
    ),
    query(
      `SELECT
         DATE_TRUNC('month', d.created_at) AS month_date,
         COALESCE(SUM(d.total_co2), 0)   AS total_co2,
         COALESCE(SUM(d.scope1_co2), 0)  AS scope1_co2,
         COALESCE(SUM(d.scope2_co2), 0)  AS scope2_co2,
         0::numeric                      AS scope3_co2
       FROM company_direct_emissions d
       WHERE d.company_id = $1 AND d.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', d.created_at)
       ORDER BY month_date ASC`,
      [companyId]
    ),
  ])

  return mergeMonthlyTrend({
    supplierRows: supplierTrendRes.rows,
    sharedRows: sharedTrendRes.rows,
    directRows: directTrendRes.rows,
    limit: months,
  })
}

async function getTopSuppliers(companyId, limit = 3) {
  const [supplierTopRes, sharedTopRes] = await Promise.all([
    query(
      `SELECT s.id AS supplier_id, s.name,
              COALESCE(SUM(e.total_co2),0) AS total_co2
       FROM suppliers s
       LEFT JOIN emissions e ON e.supplier_id = s.id
       WHERE s.company_id = $1
       GROUP BY s.id, s.name
       ORDER BY total_co2 DESC
       LIMIT $2`,
      [companyId, limit]
    ),
    query(
      `SELECT sp.id AS supplier_profile_id, sp.name,
              COALESCE(SUM(se.total_co2),0) AS total_co2
       FROM company_supplier_links l
       JOIN supplier_profiles sp ON sp.id = l.supplier_profile_id
       JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
       WHERE l.company_id = $1 AND l.share_emissions = true
       GROUP BY sp.id, sp.name
       ORDER BY total_co2 DESC
       LIMIT $2`,
      [companyId, limit]
    ),
  ])

  return supplierTopRes.rows
    .map((r) => ({ kind: 'company_supplier', supplierId: r.supplier_id, name: r.name, totalEmissionsKg: round(r.total_co2, 4) }))
    .concat(
      sharedTopRes.rows.map((r) => ({
        kind: 'shared_supplier',
        supplierProfileId: r.supplier_profile_id,
        name: r.name,
        totalEmissionsKg: round(r.total_co2, 4),
      }))
    )
    .sort((a, b) => Number(b.totalEmissionsKg || 0) - Number(a.totalEmissionsKg || 0))
    .slice(0, limit)
}

async function getQualityFlags(companyId) {
  const [qualityRes, unrealisticRes] = await Promise.all([
    query(
      `SELECT
         COUNT(*) FILTER (WHERE status='pending' AND created_at < NOW() - INTERVAL '5 days') AS overdue,
         COUNT(*) FILTER (WHERE status='pending') AS pending,
         COUNT(*) AS total
       FROM suppliers WHERE company_id = $1`,
      [companyId]
    ),
    query(
      `SELECT s.name, e.electricity_usage, e.fuel_usage, e.transport_distance
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1
         AND (
           e.electricity_usage > 10000000 OR
           e.fuel_usage > 1000000 OR
           e.transport_distance > 10000000
         )
       ORDER BY e.created_at DESC
       LIMIT 3`,
      [companyId]
    ),
  ])

  const q = qualityRes.rows[0] || {}
  const flags = []
  if (parseInt(q.overdue || 0, 10) > 0) flags.push({ type: 'warning', message: `${q.overdue} supplier(s) overdue` })
  if (parseInt(q.total || 0, 10) > 0 && parseInt(q.pending || 0, 10) === parseInt(q.total || 0, 10)) {
    flags.push({ type: 'warning', message: 'No supplier data collected yet' })
  }
  if (parseInt(q.pending || 0, 10) > 0) flags.push({ type: 'info', message: `${q.pending} supplier(s) still incomplete` })
  if (unrealisticRes.rows.length > 0) flags.push({ type: 'error', message: `Unrealistic values detected for ${unrealisticRes.rows.length} supplier submission(s)` })
  if (parseInt(q.pending || 0, 10) > 0 && parseInt(q.pending || 0, 10) / Math.max(parseInt(q.total || 1, 10), 1) > 0.4) {
    flags.push({ type: 'warning', message: 'Incomplete Scope 3 data may impact compliance readiness' })
  }
  return flags
}

async function buildProDashboard({ uid, email }) {
  const company = await getCompanyId(uid, email)
  if (!company) throw new Error('Company not found')

  const [grand, monthlyTrend, topSuppliers, sourceBreakdown, qualityFlags] = await Promise.all([
    getGrandTotals(company.id),
    getMonthlyTrend(company.id, 12),
    getTopSuppliers(company.id, 3),
    getSourceBreakdown(company.id),
    getQualityFlags(company.id),
  ])

  const scopeContributionsPct = {
    scope1: pct(grand.scope1Kg, grand.totalKg, 2),
    scope2: pct(grand.scope2Kg, grand.totalKg, 2),
    scope3: pct(grand.scope3Kg, grand.totalKg, 2),
  }

  const topWithPct = topSuppliers.map((s) => ({
    ...s,
    contributionPctOfGrandTotal: pct(s.totalEmissionsKg, grand.totalKg, 2),
  }))

  return {
    company: { id: company.id, name: company.name },
    totalEmissionsKg: grand.totalKg,
    scopeBreakdownKg: { scope1: grand.scope1Kg, scope2: grand.scope2Kg, scope3: grand.scope3Kg },
    scopeContributionsPct,
    categoryContributionsPct: {
      fuel: round(Number(sourceBreakdown.find((s) => s.key === 'fuel')?.share || 0), 2),
      electricity: round(Number(sourceBreakdown.find((s) => s.key === 'electricity')?.share || 0), 2),
      transport: round(Number(sourceBreakdown.find((s) => s.key === 'transport')?.share || 0), 2),
    },
    monthlyTrend,
    momComparison: buildMoMComparison(monthlyTrend),
    topSuppliers: topWithPct,
    insights: buildCompanyInsights({
      monthlyTrend,
      topSuppliers: topWithPct,
      sourceBreakdown,
      grandTotalKg: grand.totalKg,
    }),
    qualityFlags,
  }
}

module.exports = {
  getCompanyId,
  getGrandTotals,
  getMonthlyTrend,
  getTopSuppliers,
  buildMoMComparison,
  buildProDashboard,
}

