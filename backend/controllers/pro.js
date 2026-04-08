const {
  buildProDashboard,
  getCompanyId,
  getGrandTotals,
  buildMoMComparison,
} = require('../services/pro/proAnalyticsService')
const { buildSupplierInsights } = require('../services/pro/smartInsightsEngine')
const {
  syncAdvancedAlerts,
  listAdvancedAlerts,
  acknowledgeAdvancedAlert,
  resolveAdvancedAlert,
} = require('../services/pro/proAlertsService')
const { buildSupplierRankings } = require('../services/pro/proRankingService')
const { query } = require('../models/db')

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function pct(numer, denom, digits = 2) {
  const d = Number(denom || 0)
  if (d <= 0) return 0
  return Number(((Number(numer || 0) / d) * 100).toFixed(digits))
}

function completenessPctFromLatest(latest) {
  if (!latest) return 0
  const fields = [
    Number(latest.fuel_usage || 0) > 0,
    Number(latest.electricity_usage || 0) > 0,
    Number(latest.transport_distance || 0) > 0,
  ]
  const filled = fields.filter(Boolean).length
  return Math.round((filled / 3) * 100)
}

function dominantCategoryFromTotals({ scope1Kg, scope2Kg, scope3Kg }) {
  const vals = [
    { key: 'fuel', value: Number(scope1Kg || 0) },
    { key: 'electricity', value: Number(scope2Kg || 0) },
    { key: 'transport', value: Number(scope3Kg || 0) },
  ]
  vals.sort((a, b) => b.value - a.value)
  return vals[0]?.value > 0 ? vals[0].key : 'fuel'
}

function riskFromSignals({ isHighEmitter, isLowDataQuality, status }) {
  if (status === 'overdue') return { riskTag: 'high', riskTone: 'red' }
  if (isLowDataQuality) return { riskTag: 'high', riskTone: 'red' }
  if (isHighEmitter) return { riskTag: 'medium', riskTone: 'yellow' }
  if (status !== 'completed') return { riskTag: 'medium', riskTone: 'yellow' }
  return { riskTag: 'low', riskTone: 'green' }
}

async function getProDashboard(req, res) {
  try {
    const data = await buildProDashboard({ uid: req.uid, email: req.email })
    await syncAdvancedAlerts(data.company.id)
    const [alerts, rankings] = await Promise.all([
      listAdvancedAlerts(data.company.id, 'open', 8),
      buildSupplierRankings(data.company.id),
    ])
    res.json({ ...data, alerts, rankings })
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to build PRO dashboard' })
  }
}

async function getProSuppliers(req, res) {
  try {
    const company = await getCompanyId(req.uid, req.email)
    if (!company) return res.status(404).json({ message: 'Company not found' })

    const grand = await getGrandTotals(company.id)
    const grandTotalKg = Number(grand.totalKg || 0) || 0

    const suppliersRes = await query(
      `SELECT id, name, status, created_at
       FROM suppliers
       WHERE company_id = $1
       ORDER BY created_at DESC`,
      [company.id]
    )

    const aggRes = await query(
      `SELECT
         s.id AS supplier_id,
         COALESCE(SUM(e.total_co2),0)  AS total_co2,
         COALESCE(SUM(e.scope1_co2),0) AS scope1_co2,
         COALESCE(SUM(e.scope2_co2),0) AS scope2_co2,
         COALESCE(SUM(e.scope3_co2),0) AS scope3_co2,
         MAX(e.created_at) AS last_submitted_at
       FROM suppliers s
       LEFT JOIN emissions e ON e.supplier_id = s.id
       WHERE s.company_id = $1
       GROUP BY s.id`,
      [company.id]
    )
    const aggById = new Map(aggRes.rows.map((r) => [r.supplier_id, r]))

    const latestRes = await query(
      `SELECT DISTINCT ON (e.supplier_id)
         e.supplier_id,
         e.electricity_usage,
         e.fuel_usage,
         e.transport_distance,
         e.created_at
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1
       ORDER BY e.supplier_id, e.created_at DESC`,
      [company.id]
    )
    const latestById = new Map(latestRes.rows.map((r) => [r.supplier_id, r]))

    const totals = aggRes.rows.map((r) => Number(r.total_co2 || 0)).filter((v) => v > 0).sort((a, b) => a - b)
    const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
    const p80 = totals.length ? totals[Math.floor(totals.length * 0.8)] : 0
    const highThreshold = Math.max(avg * 1.5, p80 || 0)

    const items = suppliersRes.rows
      .map((s) => {
        const agg = aggById.get(s.id) || {}
        const latest = latestById.get(s.id) || null
        const totalCo2Kg = round(agg.total_co2, 4)
        const scope1Kg = round(agg.scope1_co2, 4)
        const scope2Kg = round(agg.scope2_co2, 4)
        const scope3Kg = round(agg.scope3_co2, 4)

        const dataCompletenessPct = completenessPctFromLatest(latest)
        const unrealistic =
          Number(latest?.electricity_usage || 0) > 10_000_000 ||
          Number(latest?.fuel_usage || 0) > 1_000_000 ||
          Number(latest?.transport_distance || 0) > 10_000_000
        const isLowDataQuality = dataCompletenessPct < 67 || unrealistic
        const isHighEmitter = totalCo2Kg > 0 && totalCo2Kg >= highThreshold
        const isCompleted = s.status === 'completed'

        const { riskTag, riskTone } = riskFromSignals({ isHighEmitter, isLowDataQuality, status: s.status })

        return {
          supplierId: s.id,
          name: s.name,
          status: s.status,
          totalCo2Kg,
          scope1Kg,
          scope2Kg,
          scope3Kg,
          scopeContributionsPct: {
            scope1: pct(scope1Kg, totalCo2Kg, 2),
            scope2: pct(scope2Kg, totalCo2Kg, 2),
            scope3: pct(scope3Kg, totalCo2Kg, 2),
          },
          categoryContributionsPct: {
            fuel: pct(scope1Kg, totalCo2Kg, 2),
            electricity: pct(scope2Kg, totalCo2Kg, 2),
            transport: pct(scope3Kg, totalCo2Kg, 2),
          },
          contributionPctOfGrandTotal: pct(totalCo2Kg, grandTotalKg, 2),
          dataCompletenessPct,
          dominantCategory: dominantCategoryFromTotals({ scope1Kg, scope2Kg, scope3Kg }),
          riskTag,
          riskTone,
          isHighEmitter,
          isLowDataQuality,
          isCompleted,
        }
      })
      .sort((a, b) => Number(b.totalCo2Kg || 0) - Number(a.totalCo2Kg || 0))

    await syncAdvancedAlerts(company.id)
    const [alerts, rankings] = await Promise.all([
      listAdvancedAlerts(company.id, 'open', 8),
      buildSupplierRankings(company.id),
    ])

    const topEmitterRankMap = new Map((rankings.topEmitters || []).map((r) => [r.supplierId, r.rank]))
    const bestPerformerRankMap = new Map((rankings.bestPerformers || []).map((r) => [r.supplierId, r.rank]))
    const mostImprovedRankMap = new Map((rankings.mostImproved || []).map((r) => [r.supplierId, r.rank]))

    res.json({
      grandTotalKg: round(grandTotalKg, 4),
      alerts,
      rankings,
      items: items.map((it) => ({
        ...it,
        ranking: {
          emitterRank: topEmitterRankMap.get(it.supplierId) || null,
          bestPerformerRank: bestPerformerRankMap.get(it.supplierId) || null,
          mostImprovedRank: mostImprovedRankMap.get(it.supplierId) || null,
        },
      })),
    })
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to load PRO suppliers' })
  }
}

async function getProSupplierDetail(req, res) {
  try {
    const company = await getCompanyId(req.uid, req.email)
    if (!company) return res.status(404).json({ message: 'Company not found' })

    const supplierRes = await query(
      `SELECT id, name, email_or_phone, status, created_at, submitted_at
       FROM suppliers
       WHERE id = $1 AND company_id = $2`,
      [req.params.id, company.id]
    )
    if (!supplierRes.rows[0]) return res.status(404).json({ message: 'Supplier not found' })

    const supplier = supplierRes.rows[0]

    const [grand, supplierAggRes, latestRes, supplierTrendRes, avgLatestRes] = await Promise.all([
      getGrandTotals(company.id),
      query(
        `SELECT
           COALESCE(SUM(total_co2),0)  AS total_co2,
           COALESCE(SUM(scope1_co2),0) AS scope1_co2,
           COALESCE(SUM(scope2_co2),0) AS scope2_co2,
           COALESCE(SUM(scope3_co2),0) AS scope3_co2
         FROM emissions
         WHERE supplier_id = $1`,
        [supplier.id]
      ),
      query(
        `SELECT electricity_usage, fuel_usage, transport_distance, total_co2, scope1_co2, scope2_co2, scope3_co2, created_at
         FROM emissions
         WHERE supplier_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [supplier.id]
      ),
      query(
        `SELECT
           DATE_TRUNC('month', created_at) AS month_date,
           COALESCE(SUM(total_co2),0)  AS total_co2,
           COALESCE(SUM(scope1_co2),0) AS scope1_co2,
           COALESCE(SUM(scope2_co2),0) AS scope2_co2,
           COALESCE(SUM(scope3_co2),0) AS scope3_co2
         FROM emissions
         WHERE supplier_id = $1
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month_date ASC`,
        [supplier.id]
      ),
      query(
        `WITH latest AS (
           SELECT DISTINCT ON (e.supplier_id)
             e.supplier_id,
             e.electricity_usage,
             e.fuel_usage,
             e.transport_distance
           FROM emissions e
           JOIN suppliers s ON s.id = e.supplier_id
           WHERE s.company_id = $1
           ORDER BY e.supplier_id, e.created_at DESC
         )
         SELECT
           COALESCE(AVG(fuel_usage),0) AS avg_fuel,
           COALESCE(AVG(electricity_usage),0) AS avg_electricity,
           COALESCE(AVG(transport_distance),0) AS avg_transport
         FROM latest`,
        [company.id]
      ),
    ])

    const agg = supplierAggRes.rows[0] || {}
    const latest = latestRes.rows[0] || null
    const avgLatest = avgLatestRes.rows[0] || {}

    const totals = {
      totalCo2Kg: round(agg.total_co2, 4),
      scope1Kg: round(agg.scope1_co2, 4),
      scope2Kg: round(agg.scope2_co2, 4),
      scope3Kg: round(agg.scope3_co2, 4),
    }

    const monthlyTrend = supplierTrendRes.rows.map((r) => {
      const dt = new Date(r.month_date)
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
      return {
        month: key,
        co2: round(r.total_co2, 4),
        scope1: round(r.scope1_co2, 4),
        scope2: round(r.scope2_co2, 4),
        scope3: round(r.scope3_co2, 4),
      }
    })

    const contributionPct = pct(totals.totalCo2Kg, grand.totalKg, 2)
    const dominantCategory = dominantCategoryFromTotals(totals)

    const fuel = Number(latest?.fuel_usage || 0)
    const avgFuel = Number(avgLatest.avg_fuel || 0)
    const fuelVsAvg = avgFuel > 0 ? fuel / avgFuel : null

    const smartInsights = buildSupplierInsights({
      supplierTotals: totals,
      supplierTrend: monthlyTrend,
      supplierLatest: latest,
      companyAverages: avgLatest,
      grandTotalKg: grand.totalKg,
      supplierName: supplier.name,
    })

    res.json({
      supplier,
      totals,
      scopeContributionsPct: {
        scope1: pct(totals.scope1Kg, totals.totalCo2Kg, 2),
        scope2: pct(totals.scope2Kg, totals.totalCo2Kg, 2),
        scope3: pct(totals.scope3Kg, totals.totalCo2Kg, 2),
      },
      categoryContributionsPct: {
        fuel: pct(totals.scope1Kg, totals.totalCo2Kg, 2),
        electricity: pct(totals.scope2Kg, totals.totalCo2Kg, 2),
        transport: pct(totals.scope3Kg, totals.totalCo2Kg, 2),
      },
      supplierContributionPctOfGrandTotal: round(contributionPct, 2),
      dominantCategory,
      latestActivity: latest
        ? {
            electricityKwh: Number(latest.electricity_usage || 0),
            fuelLiters: Number(latest.fuel_usage || 0),
            transportKm: Number(latest.transport_distance || 0),
            created_at: latest.created_at,
          }
        : null,
      monthlyTrend,
      momComparison: buildMoMComparison(monthlyTrend),
      fuelUsageVsAverage: fuelVsAvg != null ? round(fuelVsAvg, 3) : null,
      smartInsights,
    })
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to load PRO supplier detail' })
  }
}

async function getProAlerts(req, res) {
  try {
    const company = await getCompanyId(req.uid, req.email)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    await syncAdvancedAlerts(company.id)
    const items = await listAdvancedAlerts(company.id, req.query.status || 'open', Number(req.query.limit || 50))
    res.json({ items })
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to load PRO alerts' })
  }
}

async function acknowledgeProAlert(req, res) {
  try {
    const company = await getCompanyId(req.uid, req.email)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    const row = await acknowledgeAdvancedAlert(company.id, req.params.id)
    res.json(row)
  } catch (err) {
    res.status(404).json({ message: err.message || 'Failed to acknowledge PRO alert' })
  }
}

async function resolveProAlert(req, res) {
  try {
    const company = await getCompanyId(req.uid, req.email)
    if (!company) return res.status(404).json({ message: 'Company not found' })
    const row = await resolveAdvancedAlert(company.id, req.params.id)
    res.json(row)
  } catch (err) {
    res.status(404).json({ message: err.message || 'Failed to resolve PRO alert' })
  }
}

module.exports = {
  getProDashboard,
  getProSuppliers,
  getProSupplierDetail,
  getProAlerts,
  acknowledgeProAlert,
  resolveProAlert,
}

