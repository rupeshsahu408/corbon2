const { query } = require('../models/db')
const { ensureUser } = require('../services/platformIdentity')

async function registerCompany(req, res) {
  const { companyName, email } = req.body
  const uid = req.uid

  if (!companyName || !email) {
    return res.status(400).json({ message: 'Company name and email are required' })
  }

  try {
    const user = await ensureUser(uid, email, companyName)
    const existing = await query('SELECT id FROM companies WHERE firebase_uid = $1', [uid])
    if (existing.rows.length > 0) {
      await query(
        `INSERT INTO user_roles (user_id, role, company_id)
         VALUES ($1, 'company', $2)
         ON CONFLICT DO NOTHING`,
        [user.id, existing.rows[0].id]
      )
      return res.status(200).json({ message: 'Company already registered', company: existing.rows[0] })
    }

    // If the same email exists with an old/missing Firebase UID, relink it.
    const existingByEmail = await query('SELECT id FROM companies WHERE email = $1', [email])
    if (existingByEmail.rows.length > 0) {
      const relinked = await query(
        'UPDATE companies SET firebase_uid = $1, name = COALESCE(NULLIF($2, \'\'), name) WHERE id = $3 RETURNING *',
        [uid, companyName, existingByEmail.rows[0].id]
      )
      await query(
        `INSERT INTO user_roles (user_id, role, company_id)
         VALUES ($1, 'company', $2)
         ON CONFLICT DO NOTHING`,
        [user.id, relinked.rows[0].id]
      )
      return res.status(200).json({ message: 'Company relinked', company: relinked.rows[0] })
    }

    const result = await query(
      'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING *',
      [companyName, email, uid]
    )
    await query(
      `INSERT INTO user_roles (user_id, role, company_id)
       VALUES ($1, 'company', $2)
       ON CONFLICT DO NOTHING`,
      [user.id, result.rows[0].id]
    )
    res.status(201).json(result.rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Email already registered' })
    }
    console.error('[registerCompany]', err.message)
    res.status(500).json({ message: 'Failed to register company' })
  }
}

async function getCompany(req, res) {
  try {
    let result = await query('SELECT * FROM companies WHERE firebase_uid = $1', [req.uid])
    const user = await ensureUser(req.uid, req.email)

    // Fallback: find by verified token email, then relink to current uid.
    if (!result.rows.length && req.email) {
      const byEmail = await query('SELECT * FROM companies WHERE email = $1', [req.email])
      if (byEmail.rows.length) {
        result = await query(
          'UPDATE companies SET firebase_uid = $1 WHERE id = $2 RETURNING *',
          [req.uid, byEmail.rows[0].id]
        )
      }
    }

    if (!result.rows.length) {
      // Create a default company for frictionless entry (common for Google sign-in paths).
      if (!req.email) return res.status(404).json({ message: 'Company not found. Please complete signup first.' })
      const defaultName = req.email.split('@')[0] || 'My Company'
      result = await query(
        'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING *',
        [defaultName, req.email, req.uid]
      )
    }
    await query(
      `INSERT INTO user_roles (user_id, role, company_id)
       VALUES ($1, 'company', $2)
       ON CONFLICT DO NOTHING`,
      [user.id, result.rows[0].id]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('[getCompany]', err.message)
    res.status(500).json({ message: 'Failed to fetch company' })
  }
}

async function updateOnboarding(req, res) {
  const { company_type, supplier_count_estimate, exports_status } = req.body || {}
  const allowedCompanyTypes = new Set(['manufacturer', 'retail', 'logistics', 'services', 'technology', 'other'])
  const allowedExportStatuses = new Set(['yes', 'no', 'planning'])

  if (!company_type || !allowedCompanyTypes.has(company_type)) {
    return res.status(400).json({ message: 'company_type is required' })
  }
  if (supplier_count_estimate !== undefined && supplier_count_estimate !== null) {
    const n = Number(supplier_count_estimate)
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      return res.status(400).json({ message: 'supplier_count_estimate must be a realistic number' })
    }
  }
  if (!exports_status || !allowedExportStatuses.has(exports_status)) {
    return res.status(400).json({ message: 'exports_status is required' })
  }

  try {
    let companyRes = await query('SELECT id FROM companies WHERE firebase_uid = $1', [req.uid])
    if (!companyRes.rows.length && req.email) {
      const byEmail = await query('SELECT id FROM companies WHERE LOWER(email)=LOWER($1)', [req.email])
      if (byEmail.rows.length) {
        companyRes = await query('UPDATE companies SET firebase_uid=$1 WHERE id=$2 RETURNING id', [req.uid, byEmail.rows[0].id])
      }
    }
    if (!companyRes.rows.length) {
      return res.status(404).json({ message: 'Company not found' })
    }

    const updated = await query(
      `UPDATE companies
         SET company_type=$1,
             supplier_count_estimate=$2,
             exports_status=$3,
             onboarding_completed_at=COALESCE(onboarding_completed_at, NOW())
       WHERE id=$4
       RETURNING *`,
      [
        company_type,
        supplier_count_estimate === undefined ? null : supplier_count_estimate,
        exports_status,
        companyRes.rows[0].id,
      ]
    )
    res.json(updated.rows[0])
  } catch (err) {
    console.error('[updateOnboarding]', err.message)
    res.status(500).json({ message: 'Failed to update onboarding' })
  }
}

async function registerSupplier(req, res) {
  const uid = req.uid
  const email = req.email
  const { supplierName, industry_key = 'general', inviteToken } = req.body || {}
  if (!email) return res.status(400).json({ message: 'Email is required for supplier registration' })
  try {
    let inviteRow = null
    if (inviteToken) {
      const inv = await query(
        `SELECT * FROM supplier_invites WHERE token = $1 AND status = 'pending'`,
        [inviteToken]
      )
      if (!inv.rows.length) return res.status(400).json({ message: 'Invalid or expired invite' })
      inviteRow = inv.rows[0]
      if (inviteRow.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ message: 'Use the same email address the invite was sent to' })
      }
      if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
        return res.status(400).json({ message: 'Invite expired' })
      }
    }

    const user = await ensureUser(uid, email, supplierName || email.split('@')[0])
    const existingRole = await query(
      `SELECT ur.supplier_profile_id, sp.*
       FROM user_roles ur
       JOIN supplier_profiles sp ON sp.id = ur.supplier_profile_id
       WHERE ur.user_id = $1 AND ur.role = 'supplier' AND ur.supplier_profile_id IS NOT NULL
       LIMIT 1`,
      [user.id]
    )
    if (existingRole.rows.length) {
      if (inviteRow) {
        await query(
          `UPDATE supplier_invites SET status = 'accepted', accepted_at = NOW(), supplier_profile_id = $1 WHERE id = $2`,
          [existingRole.rows[0].id, inviteRow.id]
        )
        await query(
          `INSERT INTO company_supplier_links (company_id, supplier_profile_id, status, share_emissions)
           VALUES ($1, $2, 'accepted', true)
           ON CONFLICT (company_id, supplier_profile_id)
           DO UPDATE SET status = 'accepted', share_emissions = true, updated_at = NOW()`,
          [inviteRow.company_id, existingRole.rows[0].id]
        )
      }
      return res.json(existingRole.rows[0])
    }

    let profileRes = await query('SELECT * FROM supplier_profiles WHERE LOWER(email) = LOWER($1) LIMIT 1', [email])
    if (!profileRes.rows.length) {
      profileRes = await query(
        `INSERT INTO supplier_profiles (owner_user_id, name, email, industry_key, is_public)
         VALUES ($1,$2,$3,$4,true)
         RETURNING *`,
        [user.id, supplierName || email.split('@')[0] || 'Supplier', email, industry_key]
      )
    } else if (!profileRes.rows[0].owner_user_id) {
      profileRes = await query(
        'UPDATE supplier_profiles SET owner_user_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [user.id, profileRes.rows[0].id]
      )
    }
    const profileId = profileRes.rows[0].id
    await query(
      `INSERT INTO user_roles (user_id, role, supplier_profile_id)
       VALUES ($1, 'supplier', $2)
       ON CONFLICT DO NOTHING`,
      [user.id, profileId]
    )

    if (inviteRow) {
      await query(
        `UPDATE supplier_invites SET status = 'accepted', accepted_at = NOW(), supplier_profile_id = $1 WHERE id = $2`,
        [profileId, inviteRow.id]
      )
      await query(
        `INSERT INTO company_supplier_links (company_id, supplier_profile_id, status, share_emissions)
         VALUES ($1, $2, 'accepted', true)
         ON CONFLICT (company_id, supplier_profile_id)
         DO UPDATE SET status = 'accepted', share_emissions = true, updated_at = NOW()`,
        [inviteRow.company_id, profileId]
      )
    }

    res.status(201).json(profileRes.rows[0])
  } catch (err) {
    console.error('[registerSupplier]', err.message)
    res.status(500).json({ message: 'Failed to register supplier' })
  }
}

module.exports = { registerCompany, getCompany, updateOnboarding, registerSupplier }
