const multer = require('multer')
const pdfParse = require('pdf-parse')
const { query } = require('../models/db')
const { calculateDirectCO2 } = require('../services/emissionsCalculator')
const { parseInvoiceText } = require('../services/invoiceParser')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

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
  return null
}

async function uploadInvoice(req, res) {
  if (!req.file) return res.status(400).json({ success: false, message: 'PDF file is required' })
  if (!String(req.file.mimetype || '').includes('pdf')) {
    return res.status(400).json({ success: false, message: 'Only PDF files are supported' })
  }

  let text = ''
  try {
    const parsed = await pdfParse(req.file.buffer)
    text = parsed.text || ''
  } catch {
    return res.status(400).json({ success: false, message: 'Unable to read PDF' })
  }

  const parsed = parseInvoiceText(text)
  if (!parsed.units) {
    return res.status(422).json({
      success: false,
      message: 'Unable to detect electricity usage',
    })
  }

  return res.json({
    success: true,
    units: parsed.units,
    confidence: parsed.confidence,
    candidates: parsed.candidates || [],
    date: parsed.date,
    status: 'parsed',
  })
}

async function confirmInvoice(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ success: false, message: 'Company not found' })

  const { units, date, company_id } = req.body || {}
  const parsedUnits = Number(units)
  if (!Number.isFinite(parsedUnits) || parsedUnits <= 0) {
    return res.status(400).json({ success: false, message: 'units must be a valid positive number' })
  }
  if (company_id && company_id !== company.id) {
    return res.status(403).json({ success: false, message: 'company_id does not match authenticated company' })
  }

  const periodLabel = date ? `Invoice ${date}` : `Invoice ${new Date().toISOString().slice(0, 10)}`
  const co2 = calculateDirectCO2({ electricity_usage: parsedUnits })

  const inserted = await query(
    `INSERT INTO company_direct_emissions
       (company_id, period_label, fuel_usage, fuel_type, electricity_usage,
        other_description, other_co2, scope1_co2, scope2_co2, total_co2, notes, source)
     VALUES ($1,$2,0,'diesel',$3,'invoice_pdf',0,$4,$5,$6,$7,'invoice_pdf')
     RETURNING *`,
    [company.id, periodLabel, parsedUnits, co2.scope1_co2, co2.scope2_co2, co2.total_co2, `Parsed from invoice${date ? ` (${date})` : ''}`]
  )

  await query(
    `INSERT INTO audit_log (company_id, action, entity_type, entity_id, details, performed_by)
     VALUES ($1,'INVOICE_CONFIRMED','direct_emission',$2,$3,$4)`,
    [company.id, inserted.rows[0].id, JSON.stringify({ units: parsedUnits, date: date || null }), req.email]
  )

  res.status(201).json({
    success: true,
    message: 'Invoice data saved',
    record: inserted.rows[0],
  })
}

module.exports = {
  uploadInvoice: [upload.single('invoice'), uploadInvoice],
  confirmInvoice,
}
