const { query } = require('../models/db')
const { CALCULATION_ENGINE_VERSION, getPublicMethodology } = require('../config/methodology')
const { FACTOR_LIBRARY_VERSION, getPublicFactorDetails, getLineageModel } = require('../config/factorLibrary')

async function getCompany(uid, email) {
  let res = await query('SELECT * FROM companies WHERE firebase_uid = $1', [uid])
  if (res.rows[0]) return res.rows[0]
  if (!email) return null
  const byEmail = await query('SELECT * FROM companies WHERE LOWER(email) = LOWER($1)', [email])
  if (byEmail.rows[0]) {
    const relinked = await query(
      'UPDATE companies SET firebase_uid = $1 WHERE id = $2 RETURNING *',
      [uid, byEmail.rows[0].id]
    )
    return relinked.rows[0] || null
  }
  const defaultName = email.split('@')[0] || 'My Company'
  const created = await query(
    'INSERT INTO companies (name, email, firebase_uid) VALUES ($1, $2, $3) RETURNING *',
    [defaultName, email, uid]
  )
  return created.rows[0] || null
}

async function getTrustOverview(req, res) {
  const company = await getCompany(req.uid, req.email)
  if (!company) return res.status(404).json({ message: 'Company not found' })

  const statsRes = await query(
    `SELECT
      COUNT(DISTINCT s.id) AS total,
      COUNT(DISTINCT s.id) FILTER (WHERE s.status='completed') AS completed
     FROM suppliers s WHERE s.company_id = $1`,
    [company.id]
  )
  const directRes = await query(
    `SELECT COUNT(*)::int AS n FROM company_direct_emissions WHERE company_id = $1`,
    [company.id]
  )
  const auditRes = await query(
    `SELECT COUNT(*)::int AS n FROM audit_log WHERE company_id = $1`,
    [company.id]
  )

  const total = parseInt(statsRes.rows[0]?.total || 0, 10)
  const completed = parseInt(statsRes.rows[0]?.completed || 0, 10)
  const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0
  const hasDirect = parseInt(directRes.rows[0]?.n || 0, 10) > 0

  res.json({
    strategicWedges: {
      documentation: 'docs/STRATEGIC_WEDGES.md',
      wedges: [
        {
          id: 'region_disclosure',
          title: 'Regional disclosure excellence (India + EU)',
          focus: 'BRSR, CBAM, CSRS/ESRS-aligned exports and completeness',
        },
        {
          id: 'scope3_supplier',
          title: 'Scope 3 + supplier motion',
          focus: 'Supplier coverage, data quality, and category depth',
        },
        {
          id: 'api_trust',
          title: 'API-first automation and trust',
          focus: 'Versioned factors, lineage, audit trail, integrations roadmap',
        },
      ],
    },
    methodology: getPublicMethodology(),
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    factorLibraryVersion: FACTOR_LIBRARY_VERSION,
    factorLibrary: getPublicFactorDetails(),
    lineageModel: getLineageModel(),
    assuranceReadiness: {
      supplierCompletionPct: completionPct,
      hasDirectScope12Entries: hasDirect,
      auditLogEntries: parseInt(auditRes.rows[0]?.n || 0, 10),
      checklist: [
        {
          id: 'factors_versioned',
          status: 'ready',
          detail: `Factor library ${FACTOR_LIBRARY_VERSION} is pinned in API responses`,
        },
        {
          id: 'lineage_documented',
          status: 'ready',
          detail: 'Activity → scope → factor keys documented in lineageModel',
        },
        {
          id: 'supplier_data_complete',
          status: completionPct >= 70 ? 'ready' : completionPct >= 40 ? 'partial' : 'gap',
          detail: `${completionPct}% of suppliers submitted (${completed}/${total})`,
        },
        {
          id: 'direct_emissions_recorded',
          status: hasDirect ? 'ready' : 'gap',
          detail: hasDirect ? 'Company direct Scope 1/2 entries exist' : 'Add direct emissions for operational boundary completeness',
        },
        {
          id: 'third_party_assurance',
          status: 'planned',
          detail: 'Auditor workflows: use audit export + snapshots; full assurance UI on roadmap',
        },
      ],
    },
    auditTrail: {
      listPath: '/api/direct-emissions/audit',
      enterprisePath: '/api/enterprise/security/audit-logs',
      note: 'Immutable history of key actions; export via API or enterprise security role',
    },
  })
}

module.exports = { getTrustOverview }
