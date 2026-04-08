const { query } = require('../models/db')
const { calculateCO2 } = require('../services/emissionsCalculator')

const LIMITS = {
  electricity_usage:  { min: 0, max: 10_000_000, label: 'Electricity usage' },
  fuel_usage:         { min: 0, max: 1_000_000,  label: 'Fuel usage' },
  transport_distance: { min: 0, max: 10_000_000, label: 'Transport distance' },
}

async function logAudit(companyId, action, entityId, details) {
  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1,$2,'supplier_emission',$3,$4,'supplier')`,
      [companyId, action, entityId, JSON.stringify(details)]
    )
  } catch {}
}

async function getSupplierForm(req, res) {
  const { token } = req.params
  const result = await query(
    'SELECT id, name, status FROM suppliers WHERE submission_token = $1',
    [token]
  )
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(result.rows[0])
}

async function submitEmissions(req, res) {
  const { token } = req.params
  const { electricity_usage, fuel_usage, transport_distance } = req.body

  const supplierRes = await query(
    `SELECT s.id, s.status, s.company_id, c.id as cid
     FROM suppliers s JOIN companies c ON c.id = s.company_id
     WHERE s.submission_token = $1`,
    [token]
  )
  if (!supplierRes.rows.length) return res.status(404).json({ message: 'Supplier not found' })

  const supplier = supplierRes.rows[0]
  if (supplier.status === 'completed') {
    return res.status(400).json({ message: 'Data already submitted' })
  }

  const fields = { electricity_usage, fuel_usage, transport_distance }
  const atLeastOne = Object.values(fields).some(v => v !== undefined && v !== '' && v !== null)
  if (!atLeastOne) return res.status(400).json({ message: 'Please fill in at least one field.' })

  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === '' || val === null) continue
    const num = parseFloat(val)
    if (isNaN(num)) return res.status(400).json({ message: `${LIMITS[key].label} must be a valid number.` })
    if (num < LIMITS[key].min) return res.status(400).json({ message: `${LIMITS[key].label} cannot be negative.` })
    if (num > LIMITS[key].max) return res.status(400).json({ message: `${LIMITS[key].label} value seems unrealistically high (max ${LIMITS[key].max.toLocaleString()}).` })
  }

  const co2 = calculateCO2({ electricity_usage, fuel_usage, transport_distance })

  await query(
    `INSERT INTO emissions
       (supplier_id, electricity_usage, fuel_usage, transport_distance,
        total_co2, scope1_co2, scope2_co2, scope3_co2, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'supplier')`,
    [supplier.id,
     electricity_usage || 0, fuel_usage || 0, transport_distance || 0,
     co2.total_co2, co2.scope1_co2, co2.scope2_co2, co2.scope3_co2]
  )

  await query(
    "UPDATE suppliers SET status='completed', submitted_at=NOW() WHERE id=$1",
    [supplier.id]
  )

  await logAudit(supplier.cid, 'SUPPLIER_SUBMITTED', supplier.id, {
    electricity_usage, fuel_usage, transport_distance, total_co2: co2.total_co2
  })

  res.json({ message: 'Submitted', total_co2: co2.total_co2 })
}

module.exports = { getSupplierForm, submitEmissions }
