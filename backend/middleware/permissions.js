const { query } = require('../models/db')
const { ensureUser, getUserRoles } = require('../services/platformIdentity')

const rolePermissionMap = {
  company: [
    'enterprise.integrations.read',
    'enterprise.integrations.write',
    'enterprise.integrations.sync',
    'enterprise.compliance.read',
    'enterprise.compliance.write',
    'enterprise.marketplace.read',
    'enterprise.marketplace.write',
    'enterprise.marketplace.buy',
    'enterprise.api.read',
    'enterprise.api.write',
    'enterprise.api.revoke',
    'enterprise.analytics.read',
    'enterprise.security.read',
    'enterprise.security.permissions.read',
    'enterprise.security.permissions.write',
    'enterprise.billing.read',
    'enterprise.billing.write',
    'enterprise.ai.read',
    'enterprise.ai.write',
    'enterprise.global.read',
    'enterprise.global.write',
  ],
  admin: [
    'enterprise.*',
  ],
  manager: [
    'enterprise.integrations.read',
    'enterprise.integrations.sync',
    'enterprise.compliance.read',
    'enterprise.compliance.write',
    'enterprise.analytics.read',
    'enterprise.security.read',
    'enterprise.security.permissions.read',
    'enterprise.global.read',
  ],
}

function hasPermission(required, permissionSet) {
  if (permissionSet.has(required)) return true
  const segments = required.split('.')
  while (segments.length > 1) {
    segments.pop()
    if (permissionSet.has(`${segments.join('.')}.*`)) return true
  }
  return permissionSet.has('*')
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const user = await ensureUser(req.uid, req.email)
      const [roles, overrides] = await Promise.all([
        getUserRoles(user.id),
        query(
          `SELECT permission_key, granted
           FROM user_permissions
           WHERE user_id = $1`,
          [user.id]
        ),
      ])

      const set = new Set()
      for (const role of roles) {
        for (const p of rolePermissionMap[role.role] || []) set.add(p)
      }
      for (const row of overrides.rows) {
        if (row.granted) set.add(row.permission_key)
        else set.delete(row.permission_key)
      }

      if (!hasPermission(permission, set)) {
        return res.status(403).json({ message: `Forbidden: missing permission ${permission}` })
      }

      req.permission = permission
      req.permissionSet = Array.from(set)
      next()
    } catch (err) {
      console.error('[permissions]', err.message)
      return res.status(500).json({ message: 'Permission check failed' })
    }
  }
}

module.exports = { requirePermission }
