const { query } = require('../models/db')
const { buildStructuredExport } = require('../services/disclosureMapper')
const { CALCULATION_ENGINE_VERSION } = require('../config/methodology')
const { FACTOR_LIBRARY_VERSION } = require('../config/factorLibrary')

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

async function exportDisclosure(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const framework = String(req.query.framework || 'cdp').toLowerCase()
  if (!['cdp', 'esrs'].includes(framework)) {
    return res.status(400).json({ message: 'framework must be cdp or esrs' })
  }

  const directRes = await query(
    `SELECT
      COALESCE(SUM(scope1_co2),0) AS s1,
      COALESCE(SUM(scope2_co2),0) AS s2,
      COALESCE(SUM(total_co2),0) AS t
     FROM company_direct_emissions WHERE company_id = $1`,
    [company.id]
  )
  const statsRes = await query(
    `SELECT
      COALESCE(SUM(e.scope1_co2),0) AS "supplierScope1",
      COALESCE(SUM(e.scope2_co2),0) AS "supplierScope2",
      COALESCE(SUM(e.scope3_co2),0) AS "supplierScope3"
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1`,
    [company.id]
  )

  const d = directRes.rows[0] || {}
  const s = statsRes.rows[0] || {}
  const scope1Total = parseFloat(s.supplierScope1) + parseFloat(d.s1 || 0)
  const scope2Total = parseFloat(s.supplierScope2) + parseFloat(d.s2 || 0)
  const scope3Total = parseFloat(s.supplierScope3)
  const grandTotal = scope1Total + scope2Total + scope3Total

  const stats = {
    companyName: company.name,
    scope1TotalKg: Number(scope1Total.toFixed(4)),
    scope2TotalKg: Number(scope2Total.toFixed(4)),
    scope3TotalKg: Number(scope3Total.toFixed(4)),
    grandTotalKg: Number(grandTotal.toFixed(4)),
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    factorLibraryVersion: FACTOR_LIBRARY_VERSION,
  }

  const payload = buildStructuredExport(framework, stats)
  if (!payload) return res.status(400).json({ message: 'Unknown framework' })

  res.json(payload)
}

module.exports = { exportDisclosure }
