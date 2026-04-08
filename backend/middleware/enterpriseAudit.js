const { query } = require('../models/db')
const { resolveCompanyContext } = require('../services/enterpriseContext')

function enterpriseAudit(action) {
  return async (req, res, next) => {
    let companyId = null
    try {
      const context = await resolveCompanyContext(req.uid, req.email)
      companyId = context.companyId
    } catch {}

    const startedAt = Date.now()
    res.on('finish', async () => {
      if (!companyId) return
      try {
        await query(
          `INSERT INTO audit_log (company_id, action, entity_type, details, performed_by)
           VALUES ($1,$2,$3,$4,$5)`,
          [
            companyId,
            action,
            'enterprise',
            JSON.stringify({
              endpoint: req.originalUrl,
              method: req.method,
              statusCode: res.statusCode,
              durationMs: Date.now() - startedAt,
              permission: req.permission || null,
            }),
            req.email || req.uid || null,
          ]
        )
      } catch {}
    })
    next()
  }
}

module.exports = { enterpriseAudit }
