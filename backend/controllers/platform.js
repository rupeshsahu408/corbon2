const crypto = require('crypto')
const { query } = require('../models/db')
const { calculateCO2 } = require('../services/emissionsCalculator')
const { ensureUser, getUserRoles } = require('../services/platformIdentity')
const { sendSupplierNetworkInviteEmail } = require('../services/emailService')

function getFrontendBaseUrl() {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, '')
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  return 'http://localhost:5173'
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function resolveCompanyForUser(uid, email) {
  const user = await ensureUser(uid, email)
  const roleRes = await query(
    `SELECT company_id FROM user_roles
     WHERE user_id = $1 AND role = 'company' AND company_id IS NOT NULL
     ORDER BY created_at ASC LIMIT 1`,
    [user.id]
  )
  if (roleRes.rows.length) return { user, companyId: roleRes.rows[0].company_id }
  const companyRes = await query('SELECT id FROM companies WHERE firebase_uid = $1 OR LOWER(email)=LOWER($2) LIMIT 1', [uid, email || ''])
  if (!companyRes.rows.length) return { user, companyId: null }
  const companyId = companyRes.rows[0].id
  await query(
    `INSERT INTO user_roles (user_id, role, company_id)
     VALUES ($1, 'company', $2)
     ON CONFLICT DO NOTHING`,
    [user.id, companyId]
  )
  return { user, companyId }
}

async function resolveSupplierForUser(uid, email) {
  const user = await ensureUser(uid, email)
  const roleRes = await query(
    `SELECT supplier_profile_id FROM user_roles
     WHERE user_id = $1 AND role = 'supplier' AND supplier_profile_id IS NOT NULL
     ORDER BY created_at ASC LIMIT 1`,
    [user.id]
  )
  if (!roleRes.rows.length) return { user, supplierId: null }
  return { user, supplierId: roleRes.rows[0].supplier_profile_id }
}

async function upsertSupplierProfile(req, res) {
  try {
    const { name, industry_key = 'general', is_public = true, bio = '' } = req.body
    const user = await ensureUser(req.uid, req.email)
    let supplierRes = await query('SELECT * FROM supplier_profiles WHERE owner_user_id = $1', [user.id])
    if (supplierRes.rows.length) {
      const updated = await query(
        `UPDATE supplier_profiles
         SET name = COALESCE(NULLIF($1,''), name),
             industry_key = COALESCE(NULLIF($2,''), industry_key),
             email = COALESCE(NULLIF($3,''), email),
             is_public = $4,
             bio = COALESCE($5, bio),
             updated_at = NOW()
         WHERE owner_user_id = $6 RETURNING *`,
        [name || '', industry_key || '', req.email || '', !!is_public, bio || '', user.id]
      )
      return res.json(updated.rows[0])
    }
    supplierRes = await query(
      `INSERT INTO supplier_profiles (owner_user_id, name, email, industry_key, is_public, bio)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user.id, name || (req.email || '').split('@')[0] || 'Supplier', req.email, industry_key, !!is_public, bio || '']
    )
    const profile = supplierRes.rows[0]
    await query(
      `INSERT INTO user_roles (user_id, role, supplier_profile_id)
       VALUES ($1, 'supplier', $2)
       ON CONFLICT DO NOTHING`,
      [user.id, profile.id]
    )
    res.status(201).json(profile)
  } catch (err) {
    console.error('[platform.upsertSupplierProfile]', err.message)
    res.status(500).json({ message: 'Failed to setup supplier profile' })
  }
}

async function getMe(req, res) {
  try {
    const user = await ensureUser(req.uid, req.email)
    const roles = await getUserRoles(user.id)
    res.json({ user, roles })
  } catch (err) {
    console.error('[platform.getMe]', err.message)
    res.status(500).json({ message: 'Failed to fetch user context' })
  }
}

async function connectSupplier(req, res) {
  try {
    const { user, companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const { supplierEmail, supplierName } = req.body
    if (!supplierEmail) return res.status(400).json({ message: 'supplierEmail is required' })

    const companyRes = await query('SELECT name FROM companies WHERE id = $1', [companyId])
    const companyName = companyRes.rows[0]?.name || 'A company'

    let supplier = await query('SELECT * FROM supplier_profiles WHERE LOWER(email) = LOWER($1)', [supplierEmail])
    if (!supplier.rows.length) {
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const existingInv = await query(
        `SELECT id FROM supplier_invites WHERE company_id = $1 AND LOWER(email) = LOWER($2) AND status = 'pending'`,
        [companyId, supplierEmail]
      )
      if (existingInv.rows.length) {
        await query(
          `UPDATE supplier_invites SET token = $1, expires_at = $2 WHERE id = $3`,
          [token, expiresAt, existingInv.rows[0].id]
        )
      } else {
        await query(
          `INSERT INTO supplier_invites (company_id, email, token, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [companyId, supplierEmail.trim().toLowerCase(), token, expiresAt]
        )
      }
      const signupLink = `${getFrontendBaseUrl()}/signup?invite=${token}&role=supplier`
      sendSupplierNetworkInviteEmail(supplierEmail.trim(), companyName, signupLink).catch(() => {})
      return res.status(201).json({
        invited: true,
        message: 'Invite sent. The supplier can register with this email to connect.',
        signup_link: signupLink,
      })
    }

    const supplierId = supplier.rows[0].id

    const link = await query(
      `INSERT INTO company_supplier_links (company_id, supplier_profile_id, status, share_emissions)
       VALUES ($1, $2, 'accepted', true)
       ON CONFLICT (company_id, supplier_profile_id)
       DO UPDATE SET status = 'accepted', share_emissions = true, updated_at = NOW()
       RETURNING *`,
      [companyId, supplierId]
    )

    await query(
      `INSERT INTO data_requests (company_id, supplier_profile_id, requested_by_user_id, period_key, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, supplierId, user.id, currentPeriod(), 'Please submit/update your shared emissions data']
    )

    res.status(201).json({ ...link.rows[0], invited: false })
  } catch (err) {
    console.error('[platform.connectSupplier]', err.message)
    res.status(500).json({ message: 'Failed to connect supplier' })
  }
}

async function updateSupplierSharing(req, res) {
  try {
    const { supplierId } = await resolveSupplierForUser(req.uid, req.email)
    if (!supplierId) return res.status(404).json({ message: 'Supplier profile not found' })
    const { companyId } = req.params
    const {
      permission_level = 'summary',
      can_view_scope1 = true,
      can_view_scope2 = true,
      can_view_scope3 = true,
      share_emissions,
    } = req.body
    const updated = await query(
      `UPDATE company_supplier_links
       SET permission_level = $1,
           can_view_scope1 = $2,
           can_view_scope2 = $3,
           can_view_scope3 = $4,
           share_emissions = COALESCE($7, share_emissions),
           updated_at = NOW()
       WHERE company_id = $5 AND supplier_profile_id = $6
       RETURNING *`,
      [
        permission_level,
        !!can_view_scope1,
        !!can_view_scope2,
        !!can_view_scope3,
        companyId,
        supplierId,
        share_emissions === undefined ? null : !!share_emissions,
      ]
    )
    if (!updated.rows.length) return res.status(404).json({ message: 'Connection not found' })
    res.json(updated.rows[0])
  } catch (err) {
    console.error('[platform.updateSupplierSharing]', err.message)
    res.status(500).json({ message: 'Failed to update permissions' })
  }
}

async function submitSharedEmission(req, res) {
  try {
    const { supplierId } = await resolveSupplierForUser(req.uid, req.email)
    if (!supplierId) return res.status(404).json({ message: 'Supplier profile not found' })
    const { period_key = currentPeriod(), electricity_usage = 0, fuel_usage = 0, transport_distance = 0 } = req.body
    const co2 = calculateCO2({ electricity_usage, fuel_usage, transport_distance })

    const upserted = await query(
      `INSERT INTO shared_emissions
         (supplier_profile_id, period_key, electricity_usage, fuel_usage, transport_distance, total_co2, scope1_co2, scope2_co2, scope3_co2, source, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'shared_supplier', NOW())
       ON CONFLICT (supplier_profile_id, period_key)
       DO UPDATE SET
         electricity_usage = EXCLUDED.electricity_usage,
         fuel_usage = EXCLUDED.fuel_usage,
         transport_distance = EXCLUDED.transport_distance,
         total_co2 = EXCLUDED.total_co2,
         scope1_co2 = EXCLUDED.scope1_co2,
         scope2_co2 = EXCLUDED.scope2_co2,
         scope3_co2 = EXCLUDED.scope3_co2,
         updated_at = NOW()
       RETURNING *`,
      [supplierId, period_key, electricity_usage, fuel_usage, transport_distance, co2.total_co2, co2.scope1_co2, co2.scope2_co2, co2.scope3_co2]
    )

    await query(
      `UPDATE data_requests
       SET status = 'completed', updated_at = NOW()
       WHERE supplier_profile_id = $1 AND period_key = $2 AND status = 'open'`,
      [supplierId, period_key]
    )

    const scoreRes = await query(
      `WITH hist AS (
        SELECT COALESCE(AVG(total_co2), 0) AS avg_total FROM shared_emissions WHERE supplier_profile_id = $1
      )
      SELECT avg_total FROM hist`,
      [supplierId]
    )
    const avg = Number(scoreRes.rows[0]?.avg_total || 0)
    const score = Math.max(0, Math.min(100, 100 - (avg / 2000) * 100))
    const scoreN = Number(score.toFixed(2))
    await query(
      'UPDATE supplier_profiles SET emission_score = $1, supplier_score = $1, updated_at = NOW() WHERE id = $2',
      [scoreN, supplierId]
    )

    res.status(201).json(upserted.rows[0])
  } catch (err) {
    console.error('[platform.submitSharedEmission]', err.message)
    res.status(500).json({ message: 'Failed to submit shared emission' })
  }
}

async function getSupplierDashboard(req, res) {
  try {
    const { supplierId } = await resolveSupplierForUser(req.uid, req.email)
    if (!supplierId) return res.status(404).json({ message: 'Supplier profile not found. Complete supplier profile first.' })
    const [profileRes, historyRes, linksRes, requestsRes] = await Promise.all([
      query('SELECT * FROM supplier_profiles WHERE id = $1', [supplierId]),
      query('SELECT * FROM shared_emissions WHERE supplier_profile_id = $1 ORDER BY period_key DESC LIMIT 24', [supplierId]),
      query(
        `SELECT l.*, c.name AS company_name
         FROM company_supplier_links l
         JOIN companies c ON c.id = l.company_id
         WHERE l.supplier_profile_id = $1
         ORDER BY l.created_at DESC`,
        [supplierId]
      ),
      query(
        `SELECT dr.*, c.name AS company_name
         FROM data_requests dr
         JOIN companies c ON c.id = dr.company_id
         WHERE dr.supplier_profile_id = $1
         ORDER BY dr.created_at DESC`,
        [supplierId]
      ),
    ])
    res.json({
      profile: profileRes.rows[0],
      history: historyRes.rows,
      connections: linksRes.rows,
      requests: requestsRes.rows,
      suggestions: [
        { key: 'transport', title: 'Reduce transport distances for next cycle' },
        { key: 'electricity', title: 'Increase renewable electricity usage where possible' },
      ],
    })
  } catch (err) {
    console.error('[platform.getSupplierDashboard]', err.message)
    res.status(500).json({ message: 'Failed to load supplier dashboard' })
  }
}

async function createDataRequest(req, res) {
  try {
    const { user, companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const { supplier_profile_id, period_key = currentPeriod(), message = 'Please provide latest data', due_at = null } = req.body
    const created = await query(
      `INSERT INTO data_requests (company_id, supplier_profile_id, requested_by_user_id, period_key, message, due_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [companyId, supplier_profile_id, user.id, period_key, message, due_at]
    )
    res.status(201).json(created.rows[0])
  } catch (err) {
    console.error('[platform.createDataRequest]', err.message)
    res.status(500).json({ message: 'Failed to create data request' })
  }
}

async function getCompanyNetwork(req, res) {
  try {
    const { companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const [suppliersRes, trendRes] = await Promise.all([
      query(
        `SELECT l.company_id, l.supplier_profile_id, l.status, l.permission_level,
                l.can_view_scope1, l.can_view_scope2, l.can_view_scope3, l.share_emissions,
                sp.name, sp.email, sp.emission_score, sp.supplier_score,
                last.total_co2 AS latest_total_co2,
                last.period_key AS latest_period_key
         FROM company_supplier_links l
         JOIN supplier_profiles sp ON sp.id = l.supplier_profile_id
         LEFT JOIN LATERAL (
           SELECT se.total_co2, se.period_key
           FROM shared_emissions se
           WHERE se.supplier_profile_id = l.supplier_profile_id
           ORDER BY se.period_key DESC
           LIMIT 1
         ) last ON true
         WHERE l.company_id = $1
         ORDER BY l.created_at DESC`,
        [companyId]
      ),
      query(
        `SELECT se.period_key,
                COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope1 THEN se.scope1_co2 ELSE 0 END),0) AS scope1,
                COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope2 THEN se.scope2_co2 ELSE 0 END),0) AS scope2,
                COALESCE(SUM(CASE WHEN l.share_emissions AND l.can_view_scope3 THEN se.scope3_co2 ELSE 0 END),0) AS scope3,
                COALESCE(SUM(CASE WHEN l.share_emissions THEN se.total_co2 ELSE 0 END),0) AS total
         FROM company_supplier_links l
         JOIN shared_emissions se ON se.supplier_profile_id = l.supplier_profile_id
         WHERE l.company_id = $1 AND l.share_emissions = true
         GROUP BY se.period_key
         ORDER BY se.period_key DESC
         LIMIT 12`,
        [companyId]
      ),
    ])

    const nodes = [{ id: `company:${companyId}`, type: 'company', label: 'Your Company' }]
      .concat(
        suppliersRes.rows.map((s) => ({
          id: `supplier:${s.supplier_profile_id}`,
          type: 'supplier',
          label: s.name,
          score: Number(s.supplier_score ?? s.emission_score ?? 0),
        }))
      )
    const edges = suppliersRes.rows.map((s) => ({ from: `company:${companyId}`, to: `supplier:${s.supplier_profile_id}`, status: s.status }))

    const highRisk = suppliersRes.rows.filter((s) => Number((s.supplier_score ?? s.emission_score) || 0) < 45)
    const sharedCount = suppliersRes.rows.length
    res.json({
      sharedSuppliers: suppliersRes.rows,
      riskSuppliers: highRisk,
      supplierTrend: trendRes.rows.reverse(),
      graph: { nodes, edges },
      summary: {
        sharedSupplierCount: sharedCount,
        highRiskCount: highRisk.length,
      },
    })
  } catch (err) {
    console.error('[platform.getCompanyNetwork]', err.message)
    res.status(500).json({ message: 'Failed to load company network' })
  }
}

async function discoverSuppliers(req, res) {
  try {
    const { companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const q = String(req.query.q || '').trim()
    const maxScore = Number(req.query.max_score || 100)
    const minScore = Number(req.query.min_score || 0)
    const params = [companyId, minScore, maxScore]
    let where = `
      sp.is_public = true
      AND COALESCE(sp.supplier_score, sp.emission_score, 0) >= $2
      AND COALESCE(sp.supplier_score, sp.emission_score, 0) <= $3
      AND sp.id NOT IN (
        SELECT supplier_profile_id FROM company_supplier_links WHERE company_id = $1
      )
    `
    if (q) {
      params.push(`%${q.toLowerCase()}%`)
      where += ` AND (LOWER(sp.name) LIKE $${params.length} OR LOWER(sp.email) LIKE $${params.length})`
    }
    const result = await query(
      `SELECT sp.id, sp.name, sp.email, sp.industry_key, sp.emission_score, sp.supplier_score, sp.bio,
              COALESCE(last.total_co2, 0) AS latest_total_co2,
              last.period_key
       FROM supplier_profiles sp
       LEFT JOIN LATERAL (
         SELECT se.total_co2, se.period_key
         FROM shared_emissions se
         WHERE se.supplier_profile_id = sp.id
         ORDER BY se.period_key DESC
         LIMIT 1
       ) last ON true
       WHERE ${where}
       ORDER BY COALESCE(sp.supplier_score, sp.emission_score, 0) DESC, sp.created_at DESC
       LIMIT 100`,
      params
    )
    res.json(result.rows)
  } catch (err) {
    console.error('[platform.discoverSuppliers]', err.message)
    res.status(500).json({ message: 'Failed to discover suppliers' })
  }
}

async function getSupplierMarketplace(req, res) {
  try {
    const { companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const result = await query(
      `SELECT sp.id, sp.name, sp.email, sp.industry_key, sp.emission_score, sp.supplier_score, sp.bio,
              COALESCE(AVG(se.total_co2),0) AS avg_co2,
              COUNT(DISTINCT l.company_id)::int AS connected_companies
       FROM supplier_profiles sp
       LEFT JOIN shared_emissions se ON se.supplier_profile_id = sp.id
       LEFT JOIN company_supplier_links l ON l.supplier_profile_id = sp.id
       WHERE sp.is_public = true
       GROUP BY sp.id
       ORDER BY COALESCE(sp.supplier_score, sp.emission_score, 0) DESC, avg_co2 ASC
       LIMIT 200`,
      []
    )
    const greenSuppliers = result.rows.filter((r) => Number((r.supplier_score ?? r.emission_score) || 0) >= 75)
    res.json({
      items: result.rows,
      highlights: {
        greenCount: greenSuppliers.length,
        connectedCount: result.rows.filter((r) => Number(r.connected_companies || 0) > 1).length,
      },
    })
  } catch (err) {
    console.error('[platform.getSupplierMarketplace]', err.message)
    res.status(500).json({ message: 'Failed to load supplier marketplace' })
  }
}

async function connectSupplierProfile(req, res) {
  try {
    const { companyId } = await resolveCompanyForUser(req.uid, req.email)
    if (!companyId) return res.status(404).json({ message: 'Company role not found' })
    const supplierProfileId = req.params.supplierProfileId
    const exists = await query('SELECT id FROM supplier_profiles WHERE id = $1 LIMIT 1', [supplierProfileId])
    if (!exists.rows.length) return res.status(404).json({ message: 'Supplier not found' })
    const link = await query(
      `INSERT INTO company_supplier_links (company_id, supplier_profile_id, status, share_emissions)
       VALUES ($1, $2, 'accepted', true)
       ON CONFLICT (company_id, supplier_profile_id)
       DO UPDATE SET status = 'accepted', share_emissions = true, updated_at = NOW()
       RETURNING *`,
      [companyId, supplierProfileId]
    )
    res.status(201).json(link.rows[0])
  } catch (err) {
    console.error('[platform.connectSupplierProfile]', err.message)
    res.status(500).json({ message: 'Failed to connect supplier profile' })
  }
}

async function updateDataRequestStatus(req, res) {
  try {
    const { supplierId } = await resolveSupplierForUser(req.uid, req.email)
    if (!supplierId) return res.status(404).json({ message: 'Supplier profile not found' })
    const { status } = req.body
    const allowed = new Set(['open', 'in_progress', 'completed'])
    if (!allowed.has(status)) return res.status(400).json({ message: 'Invalid status' })
    const result = await query(
      `UPDATE data_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND supplier_profile_id = $3
       RETURNING *`,
      [status, req.params.id, supplierId]
    )
    if (!result.rows.length) return res.status(404).json({ message: 'Request not found' })
    res.json(result.rows[0])
  } catch (err) {
    console.error('[platform.updateDataRequestStatus]', err.message)
    res.status(500).json({ message: 'Failed to update request status' })
  }
}

module.exports = {
  getMe,
  upsertSupplierProfile,
  connectSupplier,
  updateSupplierSharing,
  submitSharedEmission,
  getSupplierDashboard,
  createDataRequest,
  getCompanyNetwork,
  discoverSuppliers,
  getSupplierMarketplace,
  connectSupplierProfile,
  updateDataRequestStatus,
}
