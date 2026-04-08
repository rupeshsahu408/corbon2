const router = require('express').Router()
const { requireApiKey, requireApiScope } = require('../middleware/apiKeyAuth')
const c = require('../controllers/publicApi')
const { query } = require('../models/db')

router.use(requireApiKey)

router.use(async (req, res, next) => {
  const start = Date.now()
  res.on('finish', async () => {
    try {
      const d = new Date()
      const periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      await query(
        `INSERT INTO api_usage_logs (api_key_id, endpoint, method, status_code, response_ms)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.apiKey?.id || null, req.path, req.method, res.statusCode, Date.now() - start]
      )
      await query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [req.apiKey.id])
      await query(
        `INSERT INTO usage_metering (company_id, metric_key, quantity, period_key)
         VALUES ($1,'public_api_call',1,$2)`,
        [req.companyId, periodKey]
      )
    } catch {}
  })
  next()
})

router.get('/health', requireApiScope('read:health'), c.publicHealth)
router.get('/emissions/summary', requireApiScope('read:emissions'), c.emissionsSummary)
router.get('/suppliers', requireApiScope('read:suppliers'), c.publicSuppliers)

module.exports = router
