const { query } = require('../models/db')

async function getSupplierInvitePublic(req, res) {
  const { token } = req.params
  if (!token || token.length < 8) return res.status(400).json({ message: 'Invalid token' })
  try {
    const inv = await query(
      `SELECT si.id, si.email, si.status, si.expires_at, c.name AS company_name
       FROM supplier_invites si
       JOIN companies c ON c.id = si.company_id
       WHERE si.token = $1`,
      [token]
    )
    if (!inv.rows.length) return res.status(404).json({ message: 'Invite not found' })
    const row = inv.rows[0]
    if (row.status !== 'pending') {
      return res.status(410).json({ message: 'This invite is no longer valid', status: row.status })
    }
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ message: 'Invite expired' })
    }
    res.json({
      email: row.email,
      company_name: row.company_name,
    })
  } catch (err) {
    console.error('[invites.getSupplierInvitePublic]', err.message)
    res.status(500).json({ message: 'Failed to load invite' })
  }
}

module.exports = { getSupplierInvitePublic }
