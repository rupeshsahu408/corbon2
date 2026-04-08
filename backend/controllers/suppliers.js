const { query } = require('../models/db')
const { getSourceBreakdown } = require('../services/intelligence/intelligenceService')
const { sendInviteEmail, sendReminderEmail } = require('../services/emailService')
const multer = require('multer')
const { parse } = require('csv-parse/sync')
const { mergeMonthlyTrend } = require('../services/analytics/mergeMonthlyTrend')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } })
const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

function getAppBaseUrl() {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`
  return 'http://localhost:5000'
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

function computeStatus(row) {
  if (row.status === 'completed') return 'completed'
  const daysSince = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSince > 5) return 'overdue'
  return 'pending'
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isEmail(value = '') {
  return EMAIL_REGEX.test(String(value).trim())
}

async function sendInviteForSupplier({ supplier, companyName }) {
  if (!isEmail(supplier.email_or_phone)) return false
  const baseUrl = getAppBaseUrl()
  const link = `${baseUrl}/supplier/${supplier.submission_token}`
  await sendInviteEmail(supplier.email_or_phone, supplier.name, companyName, link)
  await query('UPDATE suppliers SET invite_sent_at = NOW() WHERE id = $1', [supplier.id])
  return true
}

function buildSupplierTags({ suppliers, emissionsBySupplierId }) {
  const completed = suppliers
    .map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      total_co2: Number(emissionsBySupplierId.get(s.id)?.total_co2 || 0),
      hasSubmission: emissionsBySupplierId.has(s.id),
    }))
    .sort((a, b) => b.total_co2 - a.total_co2)

  const top3 = new Set(completed.slice(0, 3).filter((s) => s.total_co2 > 0).map((s) => s.id))
  const totals = completed.map((s) => s.total_co2).filter((v) => v > 0)
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0
  const highThreshold = Math.max(avg * 1.5, totals.sort((a, b) => a - b)[Math.floor(totals.length * 0.8)] || 0)

  return suppliers.map((s) => {
    const tags = []
    const hasSubmission = emissionsBySupplierId.has(s.id)
    const total = Number(emissionsBySupplierId.get(s.id)?.total_co2 || 0)

    if (!hasSubmission || s.status !== 'completed') tags.push({ key: 'pending_data', label: 'Pending data', tone: 'warning' })
    if (top3.has(s.id)) tags.push({ key: 'top_contributor', label: 'Top contributor', tone: 'info' })
    if (total > 0 && total >= highThreshold) tags.push({ key: 'high_emission', label: 'High emission supplier', tone: 'danger' })
    if (hasSubmission && total > 0 && total < Math.max(avg * 0.5, 1)) tags.push({ key: 'low_emission', label: 'Low emission supplier', tone: 'info' })

    return { supplier_id: s.id, tags, total_co2: total }
  })
}

async function getSuppliers(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const result = await query(
    'SELECT * FROM suppliers WHERE company_id = $1 ORDER BY created_at DESC',
    [company.id]
  )
  const rows = result.rows.map(s => ({ ...s, status: computeStatus(s) }))
  res.json(rows)
}

async function getSupplierTags(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const suppliersRes = await query(
    'SELECT id, name, status, created_at FROM suppliers WHERE company_id=$1 ORDER BY created_at DESC',
    [company.id]
  )
  const suppliers = suppliersRes.rows.map((s) => ({ ...s, status: computeStatus(s) }))

  const emissionsRes = await query(
    `SELECT s.id AS supplier_id, MAX(e.created_at) AS submitted_at, SUM(e.total_co2) AS total_co2
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1
     GROUP BY s.id`,
    [company.id]
  )
  const emissionsBySupplierId = new Map(emissionsRes.rows.map((r) => [r.supplier_id, r]))

  res.json({
    items: buildSupplierTags({ suppliers, emissionsBySupplierId }),
  })
}

async function addSupplier(req, res) {
  const { name, email_or_phone } = req.body
  if (!name || !email_or_phone) {
    return res.status(400).json({ message: 'Name and contact are required' })
  }

  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const result = await query(
    'INSERT INTO suppliers (company_id, name, email_or_phone) VALUES ($1, $2, $3) RETURNING *',
    [company.id, name, email_or_phone]
  )
  const supplier = result.rows[0]

  if (isEmail(email_or_phone)) sendInviteForSupplier({ supplier, companyName: company.name }).catch(() => {})

  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1,'SUPPLIER_ADDED','supplier',$2,$3,$4)`,
      [company.id, supplier.id, JSON.stringify({ name, email_or_phone }), req.email]
    )
  } catch {}

  res.status(201).json({ ...supplier, status: 'pending' })
}

async function deleteSupplier(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const result = await query(
    'DELETE FROM suppliers WHERE id = $1 AND company_id = $2 RETURNING id',
    [req.params.id, company.id]
  )
  if (!result.rows.length) return res.status(404).json({ message: 'Supplier not found' })

  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1,'SUPPLIER_DELETED','supplier',$2,'{}',$3)`,
      [company.id, req.params.id, req.email]
    )
  } catch {}

  res.json({ message: 'Deleted' })
}

async function getStats(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const supplierRes = await query(
    `SELECT id, status, created_at FROM suppliers WHERE company_id = $1`,
    [company.id]
  )

  let total = supplierRes.rows.length
  let completed = 0, pending = 0, overdue = 0
  supplierRes.rows.forEach(s => {
    const st = computeStatus(s)
    if (st === 'completed') completed++
    else if (st === 'overdue') overdue++
    else pending++
  })

  const emissionsRes = await query(
    `SELECT
      COALESCE(SUM(e.total_co2), 0)         AS "totalCo2",
      COALESCE(SUM(e.scope1_co2), 0)        AS "scope1Co2",
      COALESCE(SUM(e.scope2_co2), 0)        AS "scope2Co2",
      COALESCE(SUM(e.scope3_co2), 0)        AS "scope3Co2",
      COALESCE(SUM(e.electricity_usage), 0) AS "totalElectricity",
      COALESCE(SUM(e.fuel_usage), 0)        AS "totalFuel",
      COALESCE(SUM(e.transport_distance), 0)AS "totalTransport"
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const sharedRes = await query(
    `SELECT
      COALESCE(SUM(CASE WHEN l.share_emissions THEN se.total_co2 ELSE 0 END),0) AS "sharedTotalCo2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END),0) AS "sharedScope1Co2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END),0) AS "sharedScope2Co2",
      COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END),0) AS "sharedScope3Co2",
      COUNT(DISTINCT l.supplier_profile_id) FILTER (WHERE l.share_emissions = true) AS "sharedSupplierCount"
     FROM company_supplier_links l
     LEFT JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
     WHERE l.company_id = $1`,
    [company.id]
  )

  const directRes = await query(
    `SELECT
      COALESCE(SUM(scope1_co2),0) AS "directScope1",
      COALESCE(SUM(scope2_co2),0) AS "directScope2",
      COALESCE(SUM(total_co2),0)  AS "directTotal"
     FROM company_direct_emissions WHERE company_id = $1`,
    [company.id]
  )

  const e = emissionsRes.rows[0]
  const d = directRes.rows[0]
  const sh = sharedRes.rows[0]

  const scope1Total = parseFloat(e.scope1Co2) + parseFloat(d.directScope1) + parseFloat(sh.sharedScope1Co2)
  const scope2Total = parseFloat(e.scope2Co2) + parseFloat(d.directScope2) + parseFloat(sh.sharedScope2Co2)
  const scope3Total = parseFloat(e.scope3Co2) + parseFloat(sh.sharedScope3Co2)
  const grandTotal  = scope1Total + scope2Total + scope3Total

  res.json({
    total, completed, pending, overdue,
    totalCo2:         parseFloat(e.totalCo2) + parseFloat(sh.sharedTotalCo2),
    scope1Co2:        parseFloat(scope1Total.toFixed(4)),
    scope2Co2:        parseFloat(scope2Total.toFixed(4)),
    scope3Co2:        parseFloat(scope3Total.toFixed(4)),
    grandTotal:       parseFloat(grandTotal.toFixed(4)),
    totalElectricity: parseFloat(e.totalElectricity),
    totalFuel:        parseFloat(e.totalFuel),
    totalTransport:   parseFloat(e.totalTransport),
    directScope1:     parseFloat(d.directScope1),
    directScope2:     parseFloat(d.directScope2),
    hasDirectData:    parseFloat(d.directTotal) > 0,
    sharedSupplierCount: parseInt(sh.sharedSupplierCount || 0, 10),
  })
}

async function getAnalytics(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const topRes = await query(
    `SELECT s.name, e.total_co2, e.scope1_co2, e.scope2_co2, e.scope3_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1
     ORDER BY e.total_co2 DESC LIMIT 5`,
    [company.id]
  )
  const sharedTopRes = await query(
    `SELECT sp.name, se.total_co2, se.scope1_co2, se.scope2_co2, se.scope3_co2
     FROM company_supplier_links l
     JOIN supplier_profiles sp ON sp.id = l.supplier_profile_id
     JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
     WHERE l.company_id = $1 AND l.share_emissions = true
     ORDER BY se.total_co2 DESC LIMIT 5`,
    [company.id]
  )

  const avgRes = await query(
    `SELECT COALESCE(AVG(e.total_co2), 0) AS avg_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const totalRes = await query(
    `SELECT COALESCE(SUM(e.total_co2), 0) AS total_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )

  // Monthly trend should be chronologically correct and should not double-count months.
  // We merge supplier submissions (by created_at), shared network emissions (by period_key),
  // and direct company entries (by created_at) into a single month bucket.
  const supplierTrendRes = await query(
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
    [company.id]
  )
  const sharedTrendRes = await query(
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
    [company.id]
  )
  const directTrendRes = await query(
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
    [company.id]
  )

  const qualityRes = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status='pending' AND created_at < NOW() - INTERVAL '5 days') AS overdue,
       COUNT(*) FILTER (WHERE status='pending') AS pending,
       COUNT(*) AS total
     FROM suppliers WHERE company_id = $1`,
    [company.id]
  )
  const unrealisticRes = await query(
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
    [company.id]
  )

  const q = qualityRes.rows[0]
  const flags = []
  if (parseInt(q.overdue) > 0) flags.push({ type: 'warning', message: `${q.overdue} supplier(s) overdue` })
  if (parseInt(q.total) > 0 && parseInt(q.pending) === parseInt(q.total)) {
    flags.push({ type: 'warning', message: 'No supplier data collected yet' })
  }
  if (parseInt(q.pending) > 0) flags.push({ type: 'info', message: `${q.pending} supplier(s) still incomplete` })
  if (unrealisticRes.rows.length > 0) flags.push({ type: 'error', message: `Unrealistic values detected for ${unrealisticRes.rows.length} supplier submission(s)` })
  if (parseInt(q.pending) > 0 && parseInt(q.pending) / Math.max(parseInt(q.total || 1), 1) > 0.4) {
    flags.push({ type: 'warning', message: 'Incomplete Scope 3 data may impact compliance readiness' })
  }

  const breakdownRes = await query(
    `SELECT
      COALESCE(SUM(e.fuel_usage), 0) AS total_fuel,
      COALESCE(SUM(e.electricity_usage), 0) AS total_electricity,
      COALESCE(SUM(e.transport_distance), 0) AS total_transport
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const sourceBreakdownCo2 = await getSourceBreakdown(company.id)
  const totalSuppliersWithData = topRes.rows.length || 1
  const settingsRes = await query(
    `SELECT carbon_price_inr_per_ton, compliance_mode, region_key
     FROM company_region_settings
     WHERE company_id = $1
     LIMIT 1`,
    [company.id]
  )
  const carbonPrice = Number(settingsRes.rows[0]?.carbon_price_inr_per_ton || 2500)
  const totalCo2Num = Number(totalRes.rows?.[0]?.total_co2 || 0)
  const estimatedCarbonCostInr = Number(((totalCo2Num / 1000) * carbonPrice).toFixed(2))

  res.json({
    topEmitters: topRes.rows.concat(sharedTopRes.rows).sort((a, b) => Number(b.total_co2) - Number(a.total_co2)).slice(0, 5),
    topContributors: topRes.rows.concat(sharedTopRes.rows).sort((a, b) => Number(b.total_co2) - Number(a.total_co2)).slice(0, 3),
    avgCo2: parseFloat(avgRes.rows[0].avg_co2).toFixed(2),
    averageEmissions: parseFloat(avgRes.rows[0].avg_co2).toFixed(2),
    sourceBreakdown: {
      fuel: Number(breakdownRes.rows[0].total_fuel || 0),
      electricity: Number(breakdownRes.rows[0].total_electricity || 0),
      transportKm: Number(breakdownRes.rows[0].total_transport || 0),
    },
    sourceBreakdownCo2,
    carbonPriceInrPerTon: carbonPrice,
    estimatedCarbonCostInr,
    complianceMode: settingsRes.rows[0]?.compliance_mode || 'standard',
    complianceRegion: settingsRes.rows[0]?.region_key || 'global',
    sampleSize: totalSuppliersWithData,
    monthlyTrend: mergeMonthlyTrend({
      supplierRows: supplierTrendRes.rows,
      sharedRows: sharedTrendRes.rows,
      directRows: directTrendRes.rows,
      limit: 12,
    }),
    qualityFlags: flags,
  })
}

async function getSupplierScorecards(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const suppliersRes = await query(
    `SELECT id, name, email_or_phone, status, created_at, submitted_at, last_reminder_at, last_reminder_type
     FROM suppliers
     WHERE company_id = $1
     ORDER BY created_at DESC`,
    [company.id]
  )
  const suppliers = suppliersRes.rows.map((s) => ({ ...s, status: computeStatus(s) }))

  const emissionsAggRes = await query(
    `SELECT
       s.id AS supplier_id,
       MAX(e.created_at) AS last_submitted_at,
       COALESCE(SUM(e.total_co2),0) AS total_co2,
       COALESCE(SUM(e.scope3_co2),0) AS scope3_co2,
       COALESCE(SUM(e.electricity_usage),0) AS electricity_usage,
       COALESCE(SUM(e.fuel_usage),0) AS fuel_usage,
       COALESCE(SUM(e.transport_distance),0) AS transport_distance
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1
     GROUP BY s.id`,
    [company.id]
  )
  const aggById = new Map(emissionsAggRes.rows.map((r) => [r.supplier_id, r]))

  const scope3TotalRes = await query(
    `SELECT COALESCE(SUM(e.scope3_co2),0) AS scope3_total
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const scope3Total = Number(scope3TotalRes.rows[0]?.scope3_total || 0)
  const denom = scope3Total > 0 ? scope3Total : 1

  const remindersRes = await query(
    `SELECT supplier_id, COUNT(*)::int AS reminder_count
     FROM supplier_reminders
     WHERE supplier_id IN (SELECT id FROM suppliers WHERE company_id = $1)
     GROUP BY supplier_id`,
    [company.id]
  )
  const remindersById = new Map(remindersRes.rows.map((r) => [r.supplier_id, Number(r.reminder_count || 0)]))

  const scorecards = suppliers.map((s) => {
    const agg = aggById.get(s.id) || {}
    const hasSubmission = Number(agg.total_co2 || 0) > 0 || !!agg.last_submitted_at
    const electricity = Number(agg.electricity_usage || 0)
    const fuel = Number(agg.fuel_usage || 0)
    const transport = Number(agg.transport_distance || 0)
    const unrealistic =
      electricity > 10_000_000 ||
      fuel > 1_000_000 ||
      transport > 10_000_000
    const scope3 = Number(agg.scope3_co2 || 0)
    const scope3Share = (scope3 / denom) * 100
    const reminderCount = remindersById.get(s.id) || 0

    const completeness = hasSubmission ? 1 : 0

    let tier = 'best'
    if (s.status === 'overdue') tier = 'high-risk'
    else if (!hasSubmission) tier = 'watch'
    else if (scope3Share >= 20) tier = 'watch'
    if (unrealistic) tier = 'watch'

    return {
      supplier_id: s.id,
      name: s.name,
      email_or_phone: s.email_or_phone,
      status: s.status,
      created_at: s.created_at,
      last_submitted_at: agg.last_submitted_at || null,
      reminder_count: reminderCount,
      last_reminder_at: s.last_reminder_at || null,
      last_reminder_type: s.last_reminder_type || null,
      metrics: {
        total_co2: Number(Number(agg.total_co2 || 0).toFixed(4)),
        scope3_co2: Number(Number(scope3).toFixed(4)),
        scope3_share_pct: Number(Number(scope3Share).toFixed(2)),
      },
      quality: {
        unrealistic_values: unrealistic,
      },
      scorecard: {
        completeness,
        tier,
      },
    }
  })

  res.json({ items: scorecards })
}

async function getScope3Hotspots(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const totalsRes = await query(
    `SELECT
      COALESCE(SUM(e.scope1_co2),0) AS scope1_total,
      COALESCE(SUM(e.scope2_co2),0) AS scope2_total,
      COALESCE(SUM(e.scope3_co2),0) AS scope3_total
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const scope3Total = Number(totalsRes.rows[0]?.scope3_total || 0)
  const denom = scope3Total > 0 ? scope3Total : 1

  const topScope3Res = await query(
    `SELECT s.id AS supplier_id, s.name,
            COALESCE(SUM(e.scope3_co2),0) AS scope3_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1
     GROUP BY s.id, s.name
     ORDER BY scope3_co2 DESC
     LIMIT 10`,
    [company.id]
  )

  res.json({
    scope3TotalKg: Number(scope3Total.toFixed(4)),
    topSuppliers: topScope3Res.rows.map((r) => ({
      supplier_id: r.supplier_id,
      name: r.name,
      scope3_co2: Number(Number(r.scope3_co2 || 0).toFixed(4)),
      share_pct: Number(((Number(r.scope3_co2 || 0) / denom) * 100).toFixed(2)),
    })),
    activityBuckets: [
      {
        key: 'fuel',
        label: 'Fuel (Scope 1 proxy)',
        valueKg: Number(Number(totalsRes.rows[0]?.scope1_total || 0).toFixed(4)),
      },
      {
        key: 'electricity',
        label: 'Electricity (Scope 2 proxy)',
        valueKg: Number(Number(totalsRes.rows[0]?.scope2_total || 0).toFixed(4)),
      },
      {
        key: 'transport',
        label: 'Transport (Scope 3 proxy)',
        valueKg: Number(scope3Total.toFixed(4)),
      },
    ],
  })
}

async function bulkUpload(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  if (!req.file) return res.status(400).json({ message: 'No CSV file uploaded' })

  let records
  try {
    records = parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch {
    return res.status(400).json({ message: 'Invalid CSV format' })
  }

  const results = { added: 0, skipped: 0, invited: 0, errors: [] }
  const seenContacts = new Set()

  for (const row of records) {
    const name = row.name || row.Name || ''
    const contact = row.email || row.Email || row.phone || row.Phone || row.email_or_phone || row.contact || ''
    if (!name || !contact) {
      results.errors.push(`Row missing name or email: ${JSON.stringify(row)}`)
      results.skipped++
      continue
    }
    const cleanedName = String(name).trim()
    const cleanedContact = String(contact).trim().toLowerCase()
    if (seenContacts.has(cleanedContact)) {
      results.errors.push(`Duplicate contact in CSV: ${cleanedContact}`)
      results.skipped++
      continue
    }
    seenContacts.add(cleanedContact)
    if (cleanedContact.includes('@') && !isEmail(cleanedContact)) {
      results.errors.push(`Invalid email format: ${cleanedContact}`)
      results.skipped++
      continue
    }
    try {
      const exists = await query(
        'SELECT id FROM suppliers WHERE company_id = $1 AND LOWER(email_or_phone) = LOWER($2) LIMIT 1',
        [company.id, cleanedContact]
      )
      if (exists.rows[0]) {
        results.skipped++
        continue
      }
      const result = await query(
        'INSERT INTO suppliers (company_id, name, email_or_phone) VALUES ($1, $2, $3) RETURNING *',
        [company.id, cleanedName, cleanedContact]
      )
      const supplier = result.rows[0]
      results.added++
      if (isEmail(cleanedContact)) {
        sendInviteForSupplier({ supplier, companyName: company.name }).then(() => {
          results.invited++
        }).catch(() => {})
      }
    } catch {
      results.errors.push(`Failed to add supplier: ${name}`)
      results.skipped++
    }
  }

  res.json(results)
}

async function sendReminders(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const pendingRes = await query(`SELECT * FROM suppliers WHERE company_id = $1 AND status = 'pending'`, [company.id])
  let sent = 0

  for (const s of pendingRes.rows) {
    if (!isEmail(s.email_or_phone)) continue
    const daysOld = (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const isFinal = daysOld >= 5
    const link = `${getAppBaseUrl()}/supplier/${s.submission_token}`
    await sendReminderEmail(s.email_or_phone, s.name, company.name, link, isFinal)
    const reminderType = isFinal ? 'final' : 'manual'
    await query(
      'INSERT INTO supplier_reminders (supplier_id, reminder_type) VALUES ($1, $2) ON CONFLICT (supplier_id, reminder_type) DO NOTHING',
      [s.id, reminderType]
    )
    await query('UPDATE suppliers SET last_reminder_at = NOW(), last_reminder_type = $2 WHERE id = $1', [s.id, reminderType])
    sent++
  }

  res.json({ message: `Reminders sent to ${sent} supplier(s)` })
}

async function sendSupplierInvite(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const supplierRes = await query('SELECT * FROM suppliers WHERE id = $1 AND company_id = $2', [req.params.id, company.id])
  if (!supplierRes.rows[0]) return res.status(404).json({ message: 'Supplier not found' })
  const supplier = supplierRes.rows[0]
  if (!isEmail(supplier.email_or_phone)) return res.status(400).json({ message: 'Supplier contact is not a valid email' })
  await sendInviteForSupplier({ supplier, companyName: company.name })
  res.json({ message: 'Invite resent' })
}

async function sendSupplierReminder(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const supplierRes = await query('SELECT * FROM suppliers WHERE id = $1 AND company_id = $2', [req.params.id, company.id])
  if (!supplierRes.rows[0]) return res.status(404).json({ message: 'Supplier not found' })
  const supplier = supplierRes.rows[0]
  if (!isEmail(supplier.email_or_phone)) return res.status(400).json({ message: 'Supplier contact is not a valid email' })
  const daysOld = (Date.now() - new Date(supplier.created_at).getTime()) / (1000 * 60 * 60 * 24)
  const reminderType = daysOld >= 5 ? 'final' : 'manual'
  const link = `${getAppBaseUrl()}/supplier/${supplier.submission_token}`
  await sendReminderEmail(supplier.email_or_phone, supplier.name, company.name, link, reminderType === 'final')
  await query(
    'INSERT INTO supplier_reminders (supplier_id, reminder_type) VALUES ($1, $2) ON CONFLICT (supplier_id, reminder_type) DO NOTHING',
    [supplier.id, reminderType]
  )
  await query('UPDATE suppliers SET last_reminder_at = NOW(), last_reminder_type = $2 WHERE id = $1', [supplier.id, reminderType])
  res.json({ message: 'Reminder sent' })
}

async function getSupplierData(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const supplierRes = await query(
    'SELECT id, name, email_or_phone, status, created_at, submitted_at FROM suppliers WHERE id = $1 AND company_id = $2',
    [req.params.id, company.id]
  )
  if (!supplierRes.rows[0]) return res.status(404).json({ message: 'Supplier not found' })
  const emissionsRes = await query(
    `SELECT electricity_usage, fuel_usage, transport_distance, total_co2, scope1_co2, scope2_co2, scope3_co2, created_at
     FROM emissions WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [req.params.id]
  )
  res.json({ supplier: supplierRes.rows[0], emissions: emissionsRes.rows })
}

async function createSupplierDocumentStub(req, res) {
  const company = await getCompanyId(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })
  const supplierRes = await query('SELECT id FROM suppliers WHERE id = $1 AND company_id = $2', [req.params.id, company.id])
  if (!supplierRes.rows[0]) return res.status(404).json({ message: 'Supplier not found' })
  const inserted = await query(
    `INSERT INTO supplier_documents (supplier_id, company_id, file_name, mime_type, file_size, parse_status, metadata)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING id, file_name, parse_status, parse_hook, created_at`,
    [req.params.id, company.id, req.file.originalname, req.file.mimetype, req.file.size, JSON.stringify({ note: 'File captured for next-phase parser' })]
  )
  res.status(201).json({
    message: 'File received and queued for parser hook',
    document: inserted.rows[0],
  })
}

async function runAutomatedReminders() {
  const due2Res = await query(
    `SELECT s.id, s.name, s.email_or_phone, s.submission_token, s.company_id, c.name AS company_name
     FROM suppliers s
     JOIN companies c ON c.id = s.company_id
     WHERE s.status = 'pending'
       AND s.created_at <= NOW() - INTERVAL '2 days'
       AND s.created_at > NOW() - INTERVAL '5 days'
       AND s.email_or_phone LIKE '%@%'
       AND NOT EXISTS (
         SELECT 1 FROM supplier_reminders r WHERE r.supplier_id = s.id AND r.reminder_type = 'auto_2d'
       )`
  )
  for (const s of due2Res.rows) {
    if (!isEmail(s.email_or_phone)) continue
    const link = `${getAppBaseUrl()}/supplier/${s.submission_token}`
    await sendReminderEmail(s.email_or_phone, s.name, s.company_name, link, false)
    await query('INSERT INTO supplier_reminders (supplier_id, reminder_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [s.id, 'auto_2d'])
    await query('UPDATE suppliers SET last_reminder_at = NOW(), last_reminder_type = $2 WHERE id = $1', [s.id, 'auto_2d'])
  }

  const due5Res = await query(
    `SELECT s.id, s.name, s.email_or_phone, s.submission_token, s.company_id, c.name AS company_name
     FROM suppliers s
     JOIN companies c ON c.id = s.company_id
     WHERE s.status = 'pending'
       AND s.created_at <= NOW() - INTERVAL '5 days'
       AND s.email_or_phone LIKE '%@%'
       AND NOT EXISTS (
         SELECT 1 FROM supplier_reminders r WHERE r.supplier_id = s.id AND r.reminder_type = 'auto_5d_final'
       )`
  )
  for (const s of due5Res.rows) {
    if (!isEmail(s.email_or_phone)) continue
    const link = `${getAppBaseUrl()}/supplier/${s.submission_token}`
    await sendReminderEmail(s.email_or_phone, s.name, s.company_name, link, true)
    await query('INSERT INTO supplier_reminders (supplier_id, reminder_type) VALUES ($1, $2) ON CONFLICT DO NOTHING', [s.id, 'auto_5d_final'])
    await query('UPDATE suppliers SET last_reminder_at = NOW(), last_reminder_type = $2 WHERE id = $1', [s.id, 'auto_5d_final'])
  }

  return { sent2d: due2Res.rows.length, sent5d: due5Res.rows.length }
}

module.exports = {
  getCompanyId,
  getSuppliers, getSupplierTags, addSupplier, deleteSupplier, getStats,
  getAnalytics,
  getSupplierScorecards,
  getScope3Hotspots,
  bulkUpload: [upload.single('csv'), bulkUpload],
  sendReminders,
  sendSupplierInvite, sendSupplierReminder, getSupplierData,
  createSupplierDocumentStub: [docUpload.single('document'), createSupplierDocumentStub],
  runAutomatedReminders,
}
