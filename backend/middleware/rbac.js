const { query } = require('../models/db')
const { ensureUser } = require('../services/platformIdentity')

function requireRole(role) {
  return async (req, res, next) => {
    try {
      const user = await ensureUser(req.uid, req.email)
      const acceptedRoles = role === 'company' ? ['company', 'admin', 'manager'] : [role]
      const result = await query(
        `SELECT 1 FROM user_roles WHERE user_id = $1 AND role = ANY($2::text[]) LIMIT 1`,
        [user.id, acceptedRoles]
      )
      if (!result.rows.length) return res.status(403).json({ message: 'Forbidden' })
      req.userId = user.id
      next()
    } catch (err) {
      console.error('[rbac]', err.message)
      res.status(500).json({ message: 'RBAC check failed' })
    }
  }
}

module.exports = { requireRole }

