const { query } = require('../models/db')

async function ensureUser(uid, email, displayName = null) {
  let result = await query('SELECT * FROM users WHERE firebase_uid = $1', [uid])
  if (result.rows.length) {
    const user = result.rows[0]
    if (email && user.email !== email) {
      result = await query(
        'UPDATE users SET email = $1, display_name = COALESCE($2, display_name) WHERE id = $3 RETURNING *',
        [email, displayName, user.id]
      )
      return result.rows[0]
    }
    return user
  }

  if (email) {
    result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email])
    if (result.rows.length) {
      const relinked = await query(
        'UPDATE users SET firebase_uid = $1, display_name = COALESCE($2, display_name) WHERE id = $3 RETURNING *',
        [uid, displayName, result.rows[0].id]
      )
      return relinked.rows[0]
    }
  }

  const created = await query(
    'INSERT INTO users (firebase_uid, email, display_name) VALUES ($1, $2, $3) RETURNING *',
    [uid, email || `${uid}@unknown.local`, displayName]
  )
  return created.rows[0]
}

async function getUserRoles(userId) {
  const result = await query(
    `SELECT ur.role, ur.company_id, ur.supplier_profile_id, c.name AS company_name, sp.name AS supplier_name
     FROM user_roles ur
     LEFT JOIN companies c ON c.id = ur.company_id
     LEFT JOIN supplier_profiles sp ON sp.id = ur.supplier_profile_id
     WHERE ur.user_id = $1`,
    [userId]
  )
  return result.rows
}

module.exports = { ensureUser, getUserRoles }
