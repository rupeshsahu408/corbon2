const { query } = require('../../models/db')

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function pct(numer, denom, digits = 2) {
  const d = Number(denom || 0)
  if (d <= 0) return 0
  return Number(((Number(numer || 0) / d) * 100).toFixed(digits))
}

function rankRows(rows, keyFn) {
  return rows.map((row, idx) => ({
    ...row,
    rank: idx + 1,
    badge: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : 'standard',
    rankScore: keyFn(row),
  }))
}

async function buildSupplierRankings(companyId) {
  const aggRes = await query(
    `SELECT
       s.id AS supplier_id,
       s.name,
       s.status,
       COALESCE(SUM(e.total_co2),0) AS total_co2,
       COALESCE(SUM(e.scope1_co2),0) AS scope1_co2,
       COALESCE(SUM(e.scope2_co2),0) AS scope2_co2,
       COALESCE(SUM(e.scope3_co2),0) AS scope3_co2,
       COALESCE(SUM(e.electricity_usage),0) AS electricity_usage,
       COALESCE(SUM(e.fuel_usage),0) AS fuel_usage,
       COALESCE(SUM(e.transport_distance),0) AS transport_distance,
       MAX(e.created_at) AS last_submitted_at
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1
     GROUP BY s.id, s.name, s.status`,
    [companyId]
  )

  const monthlyRes = await query(
    `SELECT
       e.supplier_id,
       TO_CHAR(DATE_TRUNC('month', e.created_at), 'YYYY-MM') AS month,
       COALESCE(SUM(e.total_co2),0) AS total_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1 AND e.created_at >= NOW() - INTERVAL '4 months'
     GROUP BY e.supplier_id, DATE_TRUNC('month', e.created_at)
     ORDER BY month ASC`,
    [companyId]
  )
  const bySupplierMonth = new Map()
  for (const r of monthlyRes.rows) {
    if (!bySupplierMonth.has(r.supplier_id)) bySupplierMonth.set(r.supplier_id, [])
    bySupplierMonth.get(r.supplier_id).push({
      month: r.month,
      total: Number(r.total_co2 || 0),
    })
  }

  const totals = aggRes.rows.map((r) => Number(r.total_co2 || 0))
  const grand = totals.reduce((a, b) => a + b, 0)

  const base = aggRes.rows.map((r) => {
    const total = Number(r.total_co2 || 0)
    const activityTotal =
      Number(r.electricity_usage || 0) + Number(r.fuel_usage || 0) + Number(r.transport_distance || 0)
    const efficiency = activityTotal > 0 ? total / activityTotal : null

    const months = (bySupplierMonth.get(r.supplier_id) || []).slice(-2)
    const prev = Number(months[0]?.total || 0)
    const curr = Number(months[1]?.total || 0)
    const improvementPct = prev > 0 ? ((prev - curr) / prev) * 100 : 0

    return {
      supplierId: r.supplier_id,
      name: r.name,
      status: r.status,
      totalCo2Kg: round(total, 4),
      contributionPct: pct(total, grand, 2),
      efficiencyScore: efficiency == null ? null : round(1 / Math.max(efficiency, 0.000001), 6),
      improvementPct: round(improvementPct, 2),
      lastSubmittedAt: r.last_submitted_at,
    }
  })

  const topEmitters = rankRows(
    [...base].sort((a, b) => Number(b.totalCo2Kg || 0) - Number(a.totalCo2Kg || 0)).slice(0, 10),
    (r) => Number(r.totalCo2Kg || 0)
  )

  const bestPerformers = rankRows(
    [...base]
      .filter((r) => r.status === 'completed' && Number(r.totalCo2Kg || 0) > 0)
      .sort((a, b) => {
        const ea = Number(a.efficiencyScore || 0)
        const eb = Number(b.efficiencyScore || 0)
        if (eb !== ea) return eb - ea
        return Number(a.totalCo2Kg || 0) - Number(b.totalCo2Kg || 0)
      })
      .slice(0, 10),
    (r) => Number(r.efficiencyScore || 0)
  )

  const mostImproved = rankRows(
    [...base]
      .filter((r) => Number(r.improvementPct || 0) > 0)
      .sort((a, b) => Number(b.improvementPct || 0) - Number(a.improvementPct || 0))
      .slice(0, 10),
    (r) => Number(r.improvementPct || 0)
  )

  return {
    topEmitters,
    bestPerformers,
    mostImproved,
  }
}

module.exports = {
  buildSupplierRankings,
}

