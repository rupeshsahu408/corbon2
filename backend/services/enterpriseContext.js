const { query } = require('../models/db')
const { ensureUser } = require('./platformIdentity')

async function resolveCompanyContext(uid, email) {
  const user = await ensureUser(uid, email)
  const role = await query(
    `SELECT company_id FROM user_roles WHERE user_id = $1 AND role = 'company' AND company_id IS NOT NULL ORDER BY created_at ASC LIMIT 1`,
    [user.id]
  )
  if (role.rows.length) return { user, companyId: role.rows[0].company_id }
  const byUid = await query('SELECT id FROM companies WHERE firebase_uid = $1 OR LOWER(email)=LOWER($2) LIMIT 1', [uid, email || ''])
  if (!byUid.rows.length) return { user, companyId: null }
  return { user, companyId: byUid.rows[0].id }
}

module.exports = { resolveCompanyContext }
