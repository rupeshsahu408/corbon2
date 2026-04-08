const { query } = require('../models/db')
const { getPublicMethodology, CALCULATION_ENGINE_VERSION } = require('../config/methodology')
const { getSourceBreakdown } = require('../services/intelligence/intelligenceService')

async function getCompany(uid, email) {
  let res = await query('SELECT * FROM companies WHERE firebase_uid = $1', [uid])
  if (res.rows[0]) return res.rows[0]

  if (!email) return null

  const byEmail = await query('SELECT * FROM companies WHERE LOWER(email) = LOWER($1)', [email])
  if (byEmail.rows[0]) {
    const relinked = await query(
      'UPDATE companies SET firebase_uid = $1 WHERE id = $2 RETURNING *',
      [uid, byEmail.rows[0].id]
    )
    return relinked.rows[0] || null
  }

  const defaultName = email.split('@')[0] || 'My Company'
  const created = await query(
    'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING *',
    [defaultName, email, uid]
  )
  return created.rows[0] || null
}

function computeStatus(row) {
  if (row.status === 'completed') return 'completed'
  const days = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24)
  return days > 5 ? 'overdue' : 'pending'
}

async function getReport(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const complianceMode = String(req.query.mode || 'standard').toLowerCase()

  const suppliersRes = await query(
    `SELECT s.id, s.name, s.status, s.created_at,
            e.electricity_usage, e.fuel_usage, e.transport_distance,
            e.total_co2, e.scope1_co2, e.scope2_co2, e.scope3_co2, e.created_at as submitted_at
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1
     ORDER BY s.created_at DESC`,
    [company.id]
  )

  const directRes = await query(
    `SELECT * FROM company_direct_emissions WHERE company_id = $1 ORDER BY created_at DESC`,
    [company.id]
  )
  const settingsRes = await query(
    `SELECT compliance_mode, carbon_price_inr_per_ton, region_key
     FROM company_region_settings
     WHERE company_id = $1
     LIMIT 1`,
    [company.id]
  )
  const settings = settingsRes.rows[0] || { compliance_mode: 'standard', carbon_price_inr_per_ton: 2500, region_key: 'global' }

  const statsRes = await query(
    `SELECT
      COUNT(DISTINCT s.id) AS total,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status='completed') AS completed,
      COALESCE(SUM(e.total_co2),0) AS "supplierCo2",
      COALESCE(SUM(e.scope1_co2),0) AS "supplierScope1",
      COALESCE(SUM(e.scope2_co2),0) AS "supplierScope2",
      COALESCE(SUM(e.scope3_co2),0) AS "supplierScope3"
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1`,
    [company.id]
  )

  const directTotals = directRes.rows.reduce((acc, d) => ({
    scope1: acc.scope1 + parseFloat(d.scope1_co2 || 0),
    scope2: acc.scope2 + parseFloat(d.scope2_co2 || 0),
    total:  acc.total  + parseFloat(d.total_co2  || 0),
  }), { scope1: 0, scope2: 0, total: 0 })

  const s = statsRes.rows[0]
  const scope1Total = parseFloat(s.supplierScope1) + directTotals.scope1
  const scope2Total = parseFloat(s.supplierScope2) + directTotals.scope2
  const scope3Total = parseFloat(s.supplierScope3)
  const grandTotal  = scope1Total + scope2Total + scope3Total

  const suppliers = suppliersRes.rows.map(r => ({
    ...r, status: computeStatus(r),
  }))

  // Quality flags
  const flags = []
  const overdueCount = suppliers.filter(s => s.status === 'overdue').length
  if (overdueCount > 0) flags.push({ type: 'warning', message: `${overdueCount} supplier(s) overdue — data missing` })
  if (directRes.rows.length === 0) flags.push({ type: 'info', message: 'No direct company emissions recorded (Scope 1/2)' })
  const completionRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
  if (completionRate < 50 && s.total > 0) flags.push({ type: 'warning', message: `Only ${completionRate}% of suppliers have submitted data` })
  if (parseFloat(s.supplierScope3 || 0) <= 0) flags.push({ type: 'warning', message: 'Incomplete Scope 3 data for compliance disclosures' })
  if ((settings.region_key || 'global') === 'eu' && parseFloat(scope3Total) > 0) {
    flags.push({ type: 'warning', message: 'Export risk: EU CBAM-sensitive emissions present in Scope 3 chain' })
  }
  if (parseFloat(grandTotal) > 50000) flags.push({ type: 'warning', message: 'High emission exposure may create carbon cost liability' })

  const carbonPrice = Number(settings.carbon_price_inr_per_ton || 2500)
  const estimatedCarbonCostInr = (grandTotal / 1000) * carbonPrice
  const supplierRows = suppliers.filter((r) => r.total_co2)
  const supplierTotal = supplierRows.reduce((a, b) => a + Number(b.total_co2 || 0), 0) || 1
  const supplierContribution = supplierRows
    .map((r) => ({
      supplier: r.name,
      total_co2: Number(r.total_co2 || 0),
      contribution_pct: Number(((Number(r.total_co2 || 0) / supplierTotal) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.total_co2 - a.total_co2)
    .slice(0, 10)

  const complianceSections = complianceMode === 'brsr'
    ? [
      { key: 'brsr_principle_6', title: 'BRSR Principle 6', status: completionRate >= 70 ? 'ready' : 'missing_data' },
      { key: 'brsr_supply_chain', title: 'Supply chain sustainability metrics', status: scope3Total > 0 ? 'ready' : 'missing_data' },
      { key: 'brsr_energy_intensity', title: 'Energy and emissions intensity', status: grandTotal > 0 ? 'ready' : 'missing_data' },
    ]
    : complianceMode === 'cbam'
      ? [
        { key: 'cbam_embedded', title: 'Embedded emissions traceability', status: scope3Total > 0 ? 'ready' : 'missing_data' },
        { key: 'cbam_scope_breakdown', title: 'Scope-wise disclosures', status: (scope1Total + scope2Total + scope3Total) > 0 ? 'ready' : 'missing_data' },
        { key: 'cbam_supplier_evidence', title: 'Supplier evidence quality', status: completionRate >= 70 ? 'ready' : 'partial' },
      ]
      : []

  res.json({
    companyName: company.name,
    companyEmail: company.email,
    reportDate: new Date().toISOString(),
    suppliers,
    directEmissions: directRes.rows,
    stats: {
      total: s.total,
      completed: s.completed,
      completionRate,
      supplierCo2: parseFloat(s.supplierCo2),
      scope1Total: parseFloat(scope1Total.toFixed(4)),
      scope2Total: parseFloat(scope2Total.toFixed(4)),
      scope3Total: parseFloat(scope3Total.toFixed(4)),
      grandTotal:  parseFloat(grandTotal.toFixed(4)),
      directScope1: directTotals.scope1,
      directScope2: directTotals.scope2,
      directTotal:  directTotals.total,
      estimatedCarbonCostInr: Number(estimatedCarbonCostInr.toFixed(2)),
      carbonPriceInrPerTon: carbonPrice,
    },
    compliance: {
      mode: complianceMode === 'standard' ? settings.compliance_mode || 'standard' : complianceMode,
      status: flags.some((f) => f.type === 'warning') ? 'attention_required' : 'ready',
      missingData: flags.filter((f) => f.message.toLowerCase().includes('missing') || f.message.toLowerCase().includes('incomplete')).map((f) => f.message),
      sections: complianceSections,
      riskAlerts: flags,
    },
    traceability: suppliers.map((s) => ({
      supplier_id: s.id,
      supplier_name: s.name,
      submitted_at: s.submitted_at || s.created_at,
      source: s.total_co2 ? 'supplier' : 'pending',
      submitted_by: s.email_or_phone,
    })),
    breakdown: {
      fuel_vs_electricity_vs_transport: {
        fuel: suppliers.reduce((acc, r) => acc + Number(r.fuel_usage || 0), 0),
        electricity: suppliers.reduce((acc, r) => acc + Number(r.electricity_usage || 0), 0),
        transport: suppliers.reduce((acc, r) => acc + Number(r.transport_distance || 0), 0),
      },
      supplierContribution,
    },
    flags,
    methodology: getPublicMethodology(),
  })
}

async function createInventorySnapshot(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const periodLabel = String(req.body?.periodLabel || '').trim()
  if (!periodLabel) return res.status(400).json({ message: 'periodLabel is required (e.g. 2026-Q1)' })

  const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 2000) : null

  const statsRes = await query(
    `SELECT
      COUNT(DISTINCT s.id) AS total,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status='completed') AS completed,
      COALESCE(SUM(e.total_co2),0) AS "supplierCo2",
      COALESCE(SUM(e.scope1_co2),0) AS "supplierScope1",
      COALESCE(SUM(e.scope2_co2),0) AS "supplierScope2",
      COALESCE(SUM(e.scope3_co2),0) AS "supplierScope3"
     FROM suppliers s
     LEFT JOIN emissions e ON e.supplier_id = s.id
     WHERE s.company_id = $1`,
    [company.id]
  )
  const directRes = await query(
    `SELECT COALESCE(SUM(scope1_co2),0) AS s1, COALESCE(SUM(scope2_co2),0) AS s2, COALESCE(SUM(total_co2),0) AS t
     FROM company_direct_emissions WHERE company_id = $1`,
    [company.id]
  )

  const s = statsRes.rows[0]
  const d = directRes.rows[0] || {}
  const scope1Total = parseFloat(s.supplierScope1) + parseFloat(d.s1 || 0)
  const scope2Total = parseFloat(s.supplierScope2) + parseFloat(d.s2 || 0)
  const scope3Total = parseFloat(s.supplierScope3)
  const grandTotal = scope1Total + scope2Total + scope3Total
  const completionRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0

  const sourceBreakdownCo2 = await getSourceBreakdown(company.id)

  const snapshot = {
    capturedAt: new Date().toISOString(),
    companyId: company.id,
    companyName: company.name,
    periodLabel,
    stats: {
      supplierCount: parseInt(s.total, 10),
      completedSuppliers: parseInt(s.completed, 10),
      completionRate,
      scope1TotalKg: Number(scope1Total.toFixed(4)),
      scope2TotalKg: Number(scope2Total.toFixed(4)),
      scope3TotalKg: Number(scope3Total.toFixed(4)),
      grandTotalKg: Number(grandTotal.toFixed(4)),
      supplierCo2Kg: Number(parseFloat(s.supplierCo2 || 0).toFixed(4)),
      directCo2Kg: Number(parseFloat(d.t || 0).toFixed(4)),
    },
    sourceBreakdownCo2,
    methodologySummary: {
      calculationEngineVersion: CALCULATION_ENGINE_VERSION,
      protocolRef: getPublicMethodology().protocol,
    },
  }

  const inserted = await query(
    `INSERT INTO inventory_snapshots (company_id, period_label, notes, calculation_engine_version, snapshot)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [company.id, periodLabel, notes, CALCULATION_ENGINE_VERSION, JSON.stringify(snapshot)]
  )

  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1,'INVENTORY_SNAPSHOT','inventory_snapshot',$2,$3,$4)`,
      [company.id, inserted.rows[0].id, JSON.stringify({ periodLabel }), req.email]
    )
  } catch {}

  res.status(201).json(inserted.rows[0])
}

async function listInventorySnapshots(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const result = await query(
    `SELECT id, period_label, notes, calculation_engine_version, snapshot, created_at
     FROM inventory_snapshots WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [company.id]
  )
  res.json(result.rows)
}

async function saveReport(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const { summary, report_type = 'standard' } = req.body

  const versionRes = await query(
    'SELECT COALESCE(MAX(version),0)+1 AS next_version FROM saved_reports WHERE company_id=$1',
    [company.id]
  )
  const version = versionRes.rows[0].next_version

  const result = await query(
    `INSERT INTO saved_reports (company_id, version, report_type, summary)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [company.id, version, report_type, JSON.stringify(summary)]
  )

  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1,'REPORT_GENERATED','saved_report',$2,$3,$4)`,
      [company.id, result.rows[0].id, JSON.stringify({ version, report_type }), req.email]
    )
  } catch {}

  res.status(201).json(result.rows[0])
}

async function getSavedReports(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const result = await query(
    'SELECT * FROM saved_reports WHERE company_id=$1 ORDER BY version DESC',
    [company.id]
  )
  res.json(result.rows)
}

module.exports = {
  getReport,
  saveReport,
  getSavedReports,
  createInventorySnapshot,
  listInventorySnapshots,
}
