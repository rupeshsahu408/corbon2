const { query } = require('../models/db')
const { calculateDirectCO2 } = require('../services/emissionsCalculator')
const multer = require('multer')
const { parse } = require('csv-parse/sync')

async function getCompany(uid, email) {
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

async function logAudit(companyId, action, entityType, entityId, details, performedBy) {
  try {
    await query(
      `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [companyId, action, entityType, entityId, JSON.stringify(details), performedBy]
    )
  } catch {}
}

async function getDirectEmissions(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const result = await query(
    'SELECT * FROM company_direct_emissions WHERE company_id = $1 ORDER BY created_at DESC',
    [company.id]
  )
  res.json(result.rows)
}

async function addDirectEmission(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const {
    period_label, fuel_usage = 0, fuel_type = 'diesel',
    electricity_usage = 0, other_description, other_co2 = 0, notes,
  } = req.body

  if (!period_label) return res.status(400).json({ message: 'Period label is required (e.g. "2024 Annual")' })

  const co2 = calculateDirectCO2({ fuel_usage, fuel_type, electricity_usage, other_co2 })

  const result = await query(
    `INSERT INTO company_direct_emissions
       (company_id, period_label, fuel_usage, fuel_type, electricity_usage,
        other_description, other_co2, scope1_co2, scope2_co2, total_co2, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [company.id, period_label, fuel_usage, fuel_type, electricity_usage,
     other_description, other_co2, co2.scope1_co2, co2.scope2_co2, co2.total_co2, notes]
  )
  await logAudit(company.id, 'DIRECT_EMISSION_ADDED', 'direct_emission', result.rows[0].id,
    { period_label, total_co2: co2.total_co2 }, req.email)

  res.status(201).json(result.rows[0])
}

async function deleteDirectEmission(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const result = await query(
    'DELETE FROM company_direct_emissions WHERE id = $1 AND company_id = $2 RETURNING id',
    [req.params.id, company.id]
  )
  if (!result.rows.length) return res.status(404).json({ message: 'Record not found' })
  await logAudit(company.id, 'DIRECT_EMISSION_DELETED', 'direct_emission', req.params.id, {}, req.email)
  res.json({ message: 'Deleted' })
}

async function getAuditLog(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })
  const result = await query(
    'SELECT * FROM audit_log WHERE company_id = $1 ORDER BY created_at DESC LIMIT 50',
    [company.id]
  )
  res.json(result.rows)
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

async function bulkUploadDirectEmissions(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  if (!req.file) {
    return res.status(400).json({ message: 'CSV file is required' })
  }

  let records
  try {
    records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  } catch (err) {
    return res.status(400).json({ message: 'Unable to parse CSV' })
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: 'CSV has no data rows' })
  }

  const allowedFuelTypes = new Set(['diesel', 'petrol', 'lpg', 'natural_gas'])
  const insertedRows = []
  const errors = []

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i]
    const line = i + 2 // header is line 1

    const rawPeriod = String(row.period_label || row.period || '').trim()
    if (!rawPeriod) {
      errors.push({ line, message: 'period_label is required' })
      continue
    }

    const fuelUsage = Number(row.fuel_usage || row.fuel || 0) || 0
    const electricityUsage = Number(row.electricity_usage || row.electricity || 0) || 0
    const otherCo2 = Number(row.other_co2 || row.other || 0) || 0
    const fuelType = String(row.fuel_type || 'diesel').toLowerCase()
    const notes = (row.notes || '').toString().slice(0, 2000)
    const otherDescription = (row.other_description || '').toString().slice(0, 255)

    if (!fuelUsage && !electricityUsage && !otherCo2) {
      errors.push({ line, message: 'Row has no numeric values (fuel_usage, electricity_usage, other_co2)' })
      continue
    }

    const safeFuelType = allowedFuelTypes.has(fuelType) ? fuelType : 'diesel'
    const co2 = calculateDirectCO2({
      fuel_usage: fuelUsage,
      fuel_type: safeFuelType,
      electricity_usage: electricityUsage,
      other_co2: otherCo2,
    })

    const result = await query(
      `INSERT INTO company_direct_emissions
         (company_id, period_label, fuel_usage, fuel_type, electricity_usage,
          other_description, other_co2, scope1_co2, scope2_co2, total_co2, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'csv_upload')
       RETURNING *`,
      [
        company.id,
        rawPeriod,
        fuelUsage,
        safeFuelType,
        electricityUsage,
        otherDescription || null,
        otherCo2 || 0,
        co2.scope1_co2,
        co2.scope2_co2,
        co2.total_co2,
        notes || null,
      ]
    )

    insertedRows.push(result.rows[0])
  }

  if (insertedRows.length > 0) {
    await logAudit(
      company.id,
      'DIRECT_EMISSION_BULK_UPLOAD',
      'direct_emission',
      null,
      { inserted: insertedRows.length, errors },
      req.email
    )
  }

  res.status(201).json({
    inserted: insertedRows.length,
    errors,
  })
}

module.exports = {
  getDirectEmissions,
  addDirectEmission,
  deleteDirectEmission,
  getAuditLog,
  bulkUploadDirectEmissions,
  uploadDirectCsv: upload.single('file'),
}
