const { query } = require('../../models/db')
const { getMonthlyTrend } = require('./proAnalyticsService')

function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function toSeverity(level) {
  const v = String(level || '').toLowerCase()
  if (v === 'high') return 'high'
  if (v === 'medium') return 'medium'
  return 'low'
}

async function buildAdvancedAlerts(companyId) {
  const alerts = []

  const monthly = await getMonthlyTrend(companyId, 3)
  if (monthly.length >= 2) {
    const last = Number(monthly[monthly.length - 1]?.co2 || 0)
    const prev = Number(monthly[monthly.length - 2]?.co2 || 0)
    if (prev > 0) {
      const deltaPct = ((last - prev) / prev) * 100
      if (deltaPct >= 20) {
        alerts.push({
          type: 'pro_emission_spike',
          severity: toSeverity(deltaPct >= 35 ? 'high' : 'medium'),
          message: `Emission spike detected: ${round(deltaPct, 1)}% increase vs last month`,
          payload: {
            currentMonth: monthly[monthly.length - 1]?.month,
            previousMonth: monthly[monthly.length - 2]?.month,
            deltaPct: round(deltaPct, 1),
            dedupe_key: `pro_emission_spike:${monthly[monthly.length - 1]?.month || 'latest'}`,
          },
        })
      }
    }
  }

  const pendingRes = await query(
    `SELECT
      COUNT(*) FILTER (WHERE status='pending') AS pending_count,
      COUNT(*) FILTER (WHERE status='pending' AND created_at < NOW() - INTERVAL '5 days') AS overdue_count
     FROM suppliers
     WHERE company_id = $1`,
    [companyId]
  )
  const pending = Number(pendingRes.rows[0]?.pending_count || 0)
  const overdue = Number(pendingRes.rows[0]?.overdue_count || 0)
  if (pending > 0) {
    alerts.push({
      type: 'pro_missing_supplier_data',
      severity: toSeverity(overdue >= 5 ? 'high' : overdue > 0 ? 'medium' : 'low'),
      message: `Missing supplier data: ${pending} pending, ${overdue} overdue`,
      payload: {
        pending,
        overdue,
        dedupe_key: 'pro_missing_supplier_data:current',
      },
    })
  }

  const unusualRes = await query(
    `WITH latest AS (
       SELECT DISTINCT ON (e.supplier_id)
         e.supplier_id, s.name, e.electricity_usage, e.fuel_usage, e.created_at
       FROM emissions e
       JOIN suppliers s ON s.id = e.supplier_id
       WHERE s.company_id = $1
       ORDER BY e.supplier_id, e.created_at DESC
     ), avgv AS (
       SELECT
         COALESCE(AVG(electricity_usage),0) AS avg_electricity,
         COALESCE(AVG(fuel_usage),0) AS avg_fuel
       FROM latest
     )
     SELECT l.supplier_id, l.name, l.electricity_usage, l.fuel_usage, a.avg_electricity, a.avg_fuel
     FROM latest l CROSS JOIN avgv a
     WHERE (a.avg_fuel > 0 AND l.fuel_usage > a.avg_fuel * 2)
        OR (a.avg_electricity > 0 AND l.electricity_usage > a.avg_electricity * 2)
     ORDER BY GREATEST(
       CASE WHEN a.avg_fuel > 0 THEN l.fuel_usage / a.avg_fuel ELSE 0 END,
       CASE WHEN a.avg_electricity > 0 THEN l.electricity_usage / a.avg_electricity ELSE 0 END
     ) DESC
     LIMIT 3`,
    [companyId]
  )
  if (unusualRes.rows.length > 0) {
    const top = unusualRes.rows[0]
    const fuelRatio = Number(top.avg_fuel || 0) > 0 ? Number(top.fuel_usage || 0) / Number(top.avg_fuel || 1) : 0
    const elecRatio = Number(top.avg_electricity || 0) > 0 ? Number(top.electricity_usage || 0) / Number(top.avg_electricity || 1) : 0
    const ratio = Math.max(fuelRatio, elecRatio)
    alerts.push({
      type: 'pro_unusual_usage',
      severity: toSeverity(ratio >= 3 ? 'high' : 'medium'),
      message: `Unusual usage detected for ${top.name} (${round(ratio, 2)}x baseline)`,
      payload: {
        supplier_id: top.supplier_id,
        supplier_name: top.name,
        ratio: round(ratio, 2),
        count: unusualRes.rows.length,
        dedupe_key: `pro_unusual_usage:${top.supplier_id}`,
      },
    })
  }

  return alerts
}

async function persistAdvancedAlerts(companyId, alerts) {
  const persisted = []
  for (const alert of alerts) {
    const key = String(alert.payload?.dedupe_key || `${alert.type}:generic`)
    const existing = await query(
      `SELECT id
       FROM intelligence_alerts
       WHERE company_id = $1
         AND type = $2
         AND COALESCE(payload->>'dedupe_key','') = $3
         AND status IN ('open','acknowledged')
         AND created_at >= NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [companyId, alert.type, key]
    )
    if (existing.rows.length) continue

    const inserted = await query(
      `INSERT INTO intelligence_alerts (company_id, type, severity, message, payload)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, type, severity, message, status, payload, created_at, acknowledged_at`,
      [companyId, alert.type, alert.severity, alert.message, JSON.stringify(alert.payload || {})]
    )
    persisted.push(inserted.rows[0])
  }
  return persisted
}

async function syncAdvancedAlerts(companyId) {
  const alerts = await buildAdvancedAlerts(companyId)
  await persistAdvancedAlerts(companyId, alerts)
}

async function listAdvancedAlerts(companyId, status = 'open', limit = 50) {
  const params = [companyId]
  let where = 'company_id = $1 AND type LIKE \'pro_%\''
  if (status !== 'all') {
    params.push(status)
    where += ` AND status = $${params.length}`
  }
  params.push(limit)
  const res = await query(
    `SELECT id, type, severity, message, status, payload, created_at, acknowledged_at
     FROM intelligence_alerts
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  )
  return res.rows
}

async function acknowledgeAdvancedAlert(companyId, alertId) {
  const res = await query(
    `UPDATE intelligence_alerts
     SET status='acknowledged', acknowledged_at=NOW()
     WHERE id=$1 AND company_id=$2 AND type LIKE 'pro_%'
     RETURNING id, type, severity, message, status, payload, created_at, acknowledged_at`,
    [alertId, companyId]
  )
  if (!res.rows.length) throw new Error('Alert not found')
  return res.rows[0]
}

async function resolveAdvancedAlert(companyId, alertId) {
  const res = await query(
    `UPDATE intelligence_alerts
     SET status='resolved', acknowledged_at=COALESCE(acknowledged_at, NOW())
     WHERE id=$1 AND company_id=$2 AND type LIKE 'pro_%'
     RETURNING id, type, severity, message, status, payload, created_at, acknowledged_at`,
    [alertId, companyId]
  )
  if (!res.rows.length) throw new Error('Alert not found')
  return res.rows[0]
}

module.exports = {
  buildAdvancedAlerts,
  persistAdvancedAlerts,
  syncAdvancedAlerts,
  listAdvancedAlerts,
  acknowledgeAdvancedAlert,
  resolveAdvancedAlert,
}

