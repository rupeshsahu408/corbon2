const { query } = require('../models/db')

async function publicHealth(req, res) {
  res.json({ status: 'ok', api: 'public-v1' })
}

async function emissionsSummary(req, res) {
  const companyId = req.companyId
  const period = String(req.query.period || '').trim()
  const filter = period ? ` AND TO_CHAR(e.created_at, 'YYYY-MM') = $2` : ''
  const params = period ? [companyId, period] : [companyId]
  const totals = await query(
    `SELECT
      COALESCE(SUM(e.total_co2),0) AS total_co2,
      COALESCE(SUM(e.scope1_co2),0) AS scope1_co2,
      COALESCE(SUM(e.scope2_co2),0) AS scope2_co2,
      COALESCE(SUM(e.scope3_co2),0) AS scope3_co2
     FROM emissions e
     JOIN suppliers s ON s.id = e.supplier_id
     WHERE s.company_id = $1 ${filter}`,
    params
  )
  res.json(totals.rows[0])
}

async function publicSuppliers(req, res) {
  const companyId = req.companyId
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 200)))
  const offset = Math.max(0, Number(req.query.offset || 0))
  const result = await query(
    `SELECT id, name, status, created_at
     FROM suppliers
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [companyId, limit, offset]
  )
  res.json(result.rows)
}

module.exports = { publicHealth, emissionsSummary, publicSuppliers }
