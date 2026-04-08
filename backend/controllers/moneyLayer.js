const { query } = require('../models/db')
const { getCompanyId } = require('./suppliers')
const {
  carbonCostInr,
  assessExportRisk,
  assessComplianceRisk,
  buildRecommendations,
  buildMoneyAlerts,
  maxLevel,
} = require('../services/moneyLayerEngine')
const { clearCachedOverview } = require('../services/intelligence/intelligenceService')

async function persistMoneyAlerts(company, alerts) {
  for (const alert of alerts) {
    const dup = await query(
      `SELECT id FROM intelligence_alerts
       WHERE company_id = $1 AND type = $2 AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [company.id, alert.type]
    )
    if (dup.rows.length) continue
    await query(
      `INSERT INTO intelligence_alerts (company_id, type, severity, message, payload)
       VALUES ($1,$2,$3,$4,$5)`,
      [company.id, alert.type, alert.severity, alert.message, JSON.stringify(alert.payload || {})]
    )
  }
}

async function loadEmissionTotals(companyId) {
  const emissionsRes = await query(
    `SELECT
      COALESCE(SUM(e.total_co2), 0) AS "totalCo2",
      COALESCE(SUM(e.scope1_co2), 0) AS "scope1Co2",
      COALESCE(SUM(e.scope2_co2), 0) AS "scope2Co2",
      COALESCE(SUM(e.scope3_co2), 0) AS "scope3Co2",
      COALESCE(SUM(e.fuel_usage), 0) AS "totalFuel",
      COALESCE(SUM(e.electricity_usage), 0) AS "totalElectricity"
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [companyId]
  )
  const sharedRes = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN l.share_emissions THEN se.total_co2 ELSE 0 END),0) AS "sharedTotalCo2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END),0) AS "sharedScope1Co2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END),0) AS "sharedScope2Co2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END),0) AS "sharedScope3Co2"
     FROM company_supplier_links l
     LEFT JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
     WHERE l.company_id = $1`,
    [companyId]
  )
  const directRes = await query(
    `SELECT
      COALESCE(SUM(scope1_co2),0) AS "directScope1",
      COALESCE(SUM(scope2_co2),0) AS "directScope2"
     FROM company_direct_emissions WHERE company_id = $1`,
    [companyId]
  )
  const e = emissionsRes.rows[0]
  const sh = sharedRes.rows[0]
  const d = directRes.rows[0]
  const scope1Total = parseFloat(e.scope1Co2) + parseFloat(d.directScope1) + parseFloat(sh.sharedScope1Co2)
  const scope2Total = parseFloat(e.scope2Co2) + parseFloat(d.directScope2) + parseFloat(sh.sharedScope2Co2)
  const scope3Total = parseFloat(e.scope3Co2) + parseFloat(sh.sharedScope3Co2)
  const grandTotal = scope1Total + scope2Total + scope3Total
  return {
    scope1Co2: scope1Total,
    scope2Co2: scope2Total,
    scope3Co2: scope3Total,
    grandTotal: parseFloat(grandTotal.toFixed(4)),
    totalFuel: parseFloat(e.totalFuel || 0),
    totalElectricity: parseFloat(e.totalElectricity || 0),
  }
}

function supplierRowStatus(row) {
  if (row.status === 'completed') return 'completed'
  const daysSince = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 5) return 'overdue'
  return 'pending'
}

async function loadSupplierCompletion(companyId) {
  const supplierRes = await query(
    `SELECT id, status, created_at FROM suppliers WHERE company_id = $1`,
    [companyId]
  )
  const rows = supplierRes.rows
  const total = rows.length
  let completed = 0
  let incomplete = 0
  for (const s of rows) {
    if (supplierRowStatus(s) === 'completed') completed++
    else incomplete++
  }
  const completionPct = total ? Math.round((completed / total) * 100) : 100
  const pendingRatio = total ? incomplete / total : 0
  return { total, completed, incomplete, completionPct, pendingRatio }
}

async function loadMonthlyCo2Trend(companyId) {
  const [trendRes, sharedTrendRes] = await Promise.all([
    query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', e.created_at), 'Mon YYYY') AS month,
         DATE_TRUNC('month', e.created_at)::date AS d,
         COALESCE(SUM(e.total_co2), 0) AS total_co2
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1 AND e.created_at >= NOW() - INTERVAL '8 months'
       GROUP BY DATE_TRUNC('month', e.created_at)
       ORDER BY d ASC`,
      [companyId]
    ),
    query(
      `SELECT
         TO_CHAR(TO_DATE(se.period_key || '-01', 'YYYY-MM-DD'), 'Mon YYYY') AS month,
         TO_DATE(se.period_key || '-01', 'YYYY-MM-DD')::date AS d,
         COALESCE(SUM(CASE WHEN l.share_emissions THEN se.total_co2 ELSE 0 END), 0) AS total_co2
       FROM company_supplier_links l
       JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
       WHERE l.company_id = $1
         AND TO_DATE(se.period_key || '-01', 'YYYY-MM-DD') >= DATE_TRUNC('month', NOW() - INTERVAL '8 months')::date
       GROUP BY se.period_key
       ORDER BY d ASC`,
      [companyId]
    ),
  ])
  const byDay = new Map()
  for (const r of [...trendRes.rows, ...sharedTrendRes.rows]) {
    const d = r.d ? new Date(r.d) : null
    const key = d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : String(r.month || '')
    const cur = byDay.get(key) || { month: r.month, t: d && !Number.isNaN(d.getTime()) ? d.getTime() : 0, co2_kg: 0 }
    cur.co2_kg += Number(r.total_co2 || 0)
    if (r.month) cur.month = r.month
    byDay.set(key, cur)
  }
  return [...byDay.values()]
    .sort((a, b) => a.t - b.t)
    .map(({ month, co2_kg }) => ({ month, co2_kg }))
}

async function getMoneyOverview(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const [fullCompany, settingsRes, totals, completion, monthlyCo2] = await Promise.all([
    query(
      `SELECT id, name, email, industry_key, company_type, exports_status, last_carbon_cost_inr, last_risk_level
       FROM companies WHERE id = $1`,
      [company.id]
    ),
    query(
      `SELECT carbon_price_inr_per_ton, compliance_mode, region_key
       FROM company_region_settings WHERE company_id = $1 LIMIT 1`,
      [company.id]
    ),
    loadEmissionTotals(company.id),
    loadSupplierCompletion(company.id),
    loadMonthlyCo2Trend(company.id),
  ])

  const row = fullCompany.rows[0] || {}
  const settings = settingsRes.rows[0] || {}
  const priceInrPerTon = Number(settings.carbon_price_inr_per_ton || process.env.DEFAULT_CARBON_PRICE_INR || 2500)

  const grandTotalKg = totals.grandTotal
  const estimatedCarbonCostInr = carbonCostInr(grandTotalKg, priceInrPerTon)

  const monthlyCostTrend = monthlyCo2.map((m) => ({
    month: m.month,
    co2_kg: m.co2_kg,
    cost_inr: carbonCostInr(m.co2_kg, priceInrPerTon),
  }))

  let costChangePct = null
  if (monthlyCostTrend.length >= 2) {
    const prev = monthlyCostTrend[monthlyCostTrend.length - 2].cost_inr
    const last = monthlyCostTrend[monthlyCostTrend.length - 1].cost_inr
    if (prev > 0) costChangePct = ((last - prev) / prev) * 100
    else if (last > 0) costChangePct = 100
  }

  const exportRisk = assessExportRisk({ exportsStatus: row.exports_status, grandTotalKg })
  const complianceRisk = assessComplianceRisk({
    completionPct: completion.completionPct,
    pendingRatio: completion.pendingRatio,
    scope3Kg: totals.scope3Co2,
    grandTotalKg,
    totalSuppliers: completion.total,
  })

  const overallLevel = maxLevel(exportRisk.level, complianceRisk.level)

  const recommendations = buildRecommendations({
    exportRisk,
    complianceRisk,
    totalFuel: totals.totalFuel,
    totalElectricity: totals.totalElectricity,
    grandTotalKg,
  })

  const alerts = buildMoneyAlerts({
    company: row,
    costInr: estimatedCarbonCostInr,
    costChangePct,
    exportRisk,
    complianceRisk,
  })
  if (req.query.sync === '1') {
    await persistMoneyAlerts({ id: company.id, name: row.name || company.name, email: row.email }, alerts)
    clearCachedOverview(company.id)
  }

  await query(
    `UPDATE companies
     SET last_carbon_cost_inr = $1, last_risk_level = $2, last_money_layer_at = NOW()
     WHERE id = $3`,
    [estimatedCarbonCostInr, overallLevel, company.id]
  )

  res.json({
    generatedAt: new Date().toISOString(),
    carbonPriceInrPerTon: priceInrPerTon,
    currency: 'INR',
    totalCo2Kg: grandTotalKg,
    totalTonnesCo2: Number((grandTotalKg / 1000).toFixed(4)),
    estimatedCarbonCostInr,
    monthlyCostTrend,
    trendCompare: {
      costChangePctMonthOverMonth: costChangePct,
      lastMonth: monthlyCostTrend.length ? monthlyCostTrend[monthlyCostTrend.length - 1] : null,
      previousMonth: monthlyCostTrend.length > 1 ? monthlyCostTrend[monthlyCostTrend.length - 2] : null,
    },
    risks: {
      export: exportRisk,
      compliance: complianceRisk,
      overall: {
        level: overallLevel,
        label:
          overallLevel === 'high'
            ? 'Overall risk: High'
            : overallLevel === 'medium'
              ? 'Overall risk: Medium'
              : 'Overall risk: Low',
      },
    },
    companyFlags: {
      exportsStatus: row.exports_status || null,
      exportOriented: exportRisk.exportOriented,
      industryKey: row.industry_key || 'general',
      companyType: row.company_type || null,
      supplierCompletionPct: completion.completionPct,
    },
    recommendations,
    intelligenceAlertTypesQueued: req.query.sync === '1' ? alerts.map((a) => a.type) : [],
    snapshot: {
      last_carbon_cost_inr: estimatedCarbonCostInr,
      last_risk_level: overallLevel,
    },
  })
}

async function postScenario(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const pctRaw = req.body?.emissionReductionPct ?? req.body?.reductionPercent
  const pct = Math.min(95, Math.max(0, Number(pctRaw)))
  if (!Number.isFinite(pct)) return res.status(400).json({ message: 'emissionReductionPct is required (0–95)' })

  const settingsRes = await query(
    `SELECT carbon_price_inr_per_ton FROM company_region_settings WHERE company_id = $1 LIMIT 1`,
    [company.id]
  )
  const priceInrPerTon = Number(settingsRes.rows[0]?.carbon_price_inr_per_ton || 2500)
  const totals = await loadEmissionTotals(company.id)
  const currentCost = carbonCostInr(totals.grandTotal, priceInrPerTon)
  const factor = 1 - pct / 100
  const newKg = totals.grandTotal * factor
  const newCost = carbonCostInr(newKg, priceInrPerTon)
  const savingsInr = Number((currentCost - newCost).toFixed(2))

  res.json({
    emissionReductionPct: pct,
    baselineCo2Kg: totals.grandTotal,
    scenarioCo2Kg: Number(newKg.toFixed(4)),
    baselineCostInr: currentCost,
    scenarioCostInr: newCost,
    savingsInr,
    carbonPriceInrPerTon: priceInrPerTon,
  })
}

async function patchCarbonPrice(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const raw = req.body?.carbon_price_inr_per_ton
  const price = Number(raw)
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) {
    return res.status(400).json({ message: 'carbon_price_inr_per_ton must be between 0 and 1,000,000' })
  }

  await query(
    `INSERT INTO company_region_settings (company_id, region_key, timezone, locale, compliance_mode, carbon_price_inr_per_ton, updated_at)
     VALUES ($1, 'global', 'UTC', 'en', 'standard', $2, NOW())
     ON CONFLICT (company_id) DO UPDATE SET carbon_price_inr_per_ton = EXCLUDED.carbon_price_inr_per_ton, updated_at = NOW()`,
    [company.id, price]
  )
  clearCachedOverview(company.id)
  res.json({ carbon_price_inr_per_ton: price, message: 'Carbon price updated for your organization' })
}

module.exports = { getMoneyOverview, postScenario, patchCarbonPrice }
