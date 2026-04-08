const { Pool } = require('pg')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL. Set it in backend/.env (see backend/.env.example).')
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('neon') ? { rejectUnauthorized: false } : false,
})

async function query(text, params) {
  const client = await pool.connect()
  try {
    return await client.query(text, params)
  } finally {
    client.release()
  }
}

async function initDB() {
  console.log('[DB] Initialising schema...')
  await query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      firebase_uid VARCHAR(255) UNIQUE NOT NULL,
      industry_key VARCHAR(50) DEFAULT 'general',
      company_type VARCHAR(50),
      supplier_count_estimate INTEGER,
      exports_status VARCHAR(30),
      onboarding_completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry_key VARCHAR(50) DEFAULT 'general'`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_type VARCHAR(50)`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS supplier_count_estimate INTEGER`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS exports_status VARCHAR(30)`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_carbon_cost_inr NUMERIC(14,2)`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_risk_level VARCHAR(20)`)
  await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS last_money_layer_at TIMESTAMPTZ`)
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      display_name VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS supplier_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      industry_key VARCHAR(50) DEFAULT 'general',
      emission_score NUMERIC(5,2) DEFAULT 0,
      is_public BOOLEAN DEFAULT true,
      bio TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true`)
  await query(`ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS bio TEXT`)
  await query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      supplier_profile_id UUID REFERENCES supplier_profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_company ON user_roles(user_id, role, company_id) WHERE company_id IS NOT NULL`)
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_supplier ON user_roles(user_id, role, supplier_profile_id) WHERE supplier_profile_id IS NOT NULL`)
  await query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      email_or_phone VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      submission_token UUID DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS company_supplier_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      supplier_profile_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'accepted',
      permission_level VARCHAR(20) DEFAULT 'summary',
      can_view_scope1 BOOLEAN DEFAULT true,
      can_view_scope2 BOOLEAN DEFAULT true,
      can_view_scope3 BOOLEAN DEFAULT true,
      share_emissions BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, supplier_profile_id)
    )
  `)
  await query(`ALTER TABLE company_supplier_links ADD COLUMN IF NOT EXISTS share_emissions BOOLEAN DEFAULT true`)
  await query(`
    CREATE TABLE IF NOT EXISTS supplier_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(64) UNIQUE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      accepted_at TIMESTAMPTZ,
      supplier_profile_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_invites_token ON supplier_invites(token)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_invites_company ON supplier_invites(company_id, created_at DESC)`)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invites_company_email_pending
    ON supplier_invites(company_id, LOWER(email))
    WHERE status = 'pending'
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS shared_emissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_profile_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
      period_key VARCHAR(7) NOT NULL,
      electricity_usage NUMERIC(12,4) DEFAULT 0,
      fuel_usage NUMERIC(12,4) DEFAULT 0,
      transport_distance NUMERIC(12,4) DEFAULT 0,
      total_co2 NUMERIC(12,4) DEFAULT 0,
      scope1_co2 NUMERIC(12,4) DEFAULT 0,
      scope2_co2 NUMERIC(12,4) DEFAULT 0,
      scope3_co2 NUMERIC(12,4) DEFAULT 0,
      source VARCHAR(50) DEFAULT 'shared_supplier',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(supplier_profile_id, period_key)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS data_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      supplier_profile_id UUID NOT NULL REFERENCES supplier_profiles(id) ON DELETE CASCADE,
      requested_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      period_key VARCHAR(7) NOT NULL,
      message TEXT,
      due_at TIMESTAMPTZ,
      status VARCHAR(20) DEFAULT 'open',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS emissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      electricity_usage NUMERIC(12,4),
      fuel_usage NUMERIC(12,4),
      transport_distance NUMERIC(12,4),
      total_co2 NUMERIC(12,4),
      scope1_co2 NUMERIC(12,4) DEFAULT 0,
      scope2_co2 NUMERIC(12,4) DEFAULT 0,
      scope3_co2 NUMERIC(12,4) DEFAULT 0,
      source VARCHAR(50) DEFAULT 'supplier',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ`)
  await query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`)
  await query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ`)
  await query(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_reminder_type VARCHAR(20)`)
  await query(`ALTER TABLE emissions ADD COLUMN IF NOT EXISTS scope1_co2 NUMERIC(12,4) DEFAULT 0`)
  await query(`ALTER TABLE emissions ADD COLUMN IF NOT EXISTS scope2_co2 NUMERIC(12,4) DEFAULT 0`)
  await query(`ALTER TABLE emissions ADD COLUMN IF NOT EXISTS scope3_co2 NUMERIC(12,4) DEFAULT 0`)
  await query(`ALTER TABLE emissions ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'supplier'`)
  await query(`
    CREATE TABLE IF NOT EXISTS supplier_reminders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      reminder_type VARCHAR(20) NOT NULL,
      sent_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(supplier_id, reminder_type)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS supplier_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120),
      file_size INTEGER,
      parse_status VARCHAR(20) DEFAULT 'pending',
      parse_hook VARCHAR(80) DEFAULT 'v1_stub',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS company_direct_emissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      period_label VARCHAR(100) NOT NULL,
      fuel_usage NUMERIC(12,4) DEFAULT 0,
      fuel_type VARCHAR(50) DEFAULT 'diesel',
      electricity_usage NUMERIC(12,4) DEFAULT 0,
      other_description VARCHAR(255),
      other_co2 NUMERIC(12,4) DEFAULT 0,
      scope1_co2 NUMERIC(12,4) DEFAULT 0,
      scope2_co2 NUMERIC(12,4) DEFAULT 0,
      total_co2 NUMERIC(12,4) DEFAULT 0,
      notes TEXT,
      source VARCHAR(50) DEFAULT 'manual',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id UUID,
      details JSONB,
      performed_by VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS saved_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      report_type VARCHAR(50) DEFAULT 'standard',
      summary JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS inventory_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      period_label VARCHAR(32) NOT NULL,
      notes TEXT,
      calculation_engine_version VARCHAR(32) NOT NULL,
      snapshot JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_company ON inventory_snapshots(company_id, created_at DESC)`)

  await query(`
    CREATE TABLE IF NOT EXISTS intelligence_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      payload JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      acknowledged_at TIMESTAMPTZ
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS intelligence_chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS supplier_scores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      score NUMERIC(5,2) NOT NULL,
      tier VARCHAR(20) NOT NULL,
      factors JSONB DEFAULT '{}'::jsonb,
      calculated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS industry_benchmarks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      industry_key VARCHAR(50) NOT NULL,
      metric_key VARCHAR(50) NOT NULL,
      avg_value NUMERIC(14,4) NOT NULL,
      unit VARCHAR(30) NOT NULL,
      source_label VARCHAR(120) DEFAULT 'CarbonFlow static baseline',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(industry_key, metric_key)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS compliance_frameworks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      region_key VARCHAR(20) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS company_region_settings (
      company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      region_key VARCHAR(20) NOT NULL DEFAULT 'global',
      timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
      locale VARCHAR(16) NOT NULL DEFAULT 'en',
      compliance_mode VARCHAR(20) NOT NULL DEFAULT 'standard',
      carbon_price_inr_per_ton NUMERIC(12,2) NOT NULL DEFAULT 2500,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE company_region_settings ADD COLUMN IF NOT EXISTS compliance_mode VARCHAR(20) NOT NULL DEFAULT 'standard'`)
  await query(`ALTER TABLE company_region_settings ADD COLUMN IF NOT EXISTS carbon_price_inr_per_ton NUMERIC(12,2) NOT NULL DEFAULT 2500`)
  await query(`
    CREATE TABLE IF NOT EXISTS integration_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'connected',
      config JSONB DEFAULT '{}'::jsonb,
      last_sync_at TIMESTAMPTZ,
      last_error TEXT,
      failed_attempts INTEGER DEFAULT 0,
      circuit_open_until TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`ALTER TABLE integration_connections ADD COLUMN IF NOT EXISTS last_error TEXT`)
  await query(`ALTER TABLE integration_connections ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0`)
  await query(`ALTER TABLE integration_connections ADD COLUMN IF NOT EXISTS circuit_open_until TIMESTAMPTZ`)
  await query(`
    CREATE TABLE IF NOT EXISTS integration_secrets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      connection_id UUID UNIQUE NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
      encrypted_secret TEXT NOT NULL,
      key_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      api_key_hash VARCHAR(255) NOT NULL UNIQUE,
      key_prefix VARCHAR(20) NOT NULL,
      scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
      endpoint VARCHAR(255) NOT NULL,
      method VARCHAR(10) NOT NULL,
      status_code INTEGER NOT NULL,
      response_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS carbon_credit_listings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      project_name VARCHAR(255) NOT NULL,
      region_key VARCHAR(20) DEFAULT 'global',
      price_per_credit NUMERIC(12,2) NOT NULL,
      available_credits NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS carbon_credit_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      listing_id UUID REFERENCES carbon_credit_listings(id) ON DELETE SET NULL,
      buyer_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      seller_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
      credits NUMERIC(14,2) NOT NULL,
      unit_price NUMERIC(12,2) NOT NULL,
      total_amount NUMERIC(14,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'completed',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_key VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(120) NOT NULL,
      monthly_price NUMERIC(12,2) NOT NULL,
      included_api_calls INTEGER DEFAULT 10000,
      features JSONB DEFAULT '[]'::jsonb,
      is_enterprise BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS company_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      status VARCHAR(20) DEFAULT 'active',
      started_at TIMESTAMPTZ DEFAULT NOW(),
      renewal_at TIMESTAMPTZ
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS usage_metering (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      metric_key VARCHAR(50) NOT NULL,
      quantity NUMERIC(14,2) NOT NULL,
      period_key VARCHAR(7) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS usage_aggregates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      period_key VARCHAR(7) NOT NULL,
      metric_key VARCHAR(50) NOT NULL,
      total_quantity NUMERIC(14,2) NOT NULL,
      calculated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, period_key, metric_key)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission_key VARCHAR(100) NOT NULL,
      granted BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, permission_key)
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS permission_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      template_key VARCHAR(100) NOT NULL,
      name VARCHAR(120) NOT NULL,
      permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(company_id, template_key)
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_suppliers_company_created ON suppliers(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_company_supplier_links_company ON company_supplier_links(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_company_supplier_links_supplier ON company_supplier_links(supplier_profile_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_shared_emissions_supplier_period ON shared_emissions(supplier_profile_id, period_key DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_data_requests_supplier_status ON data_requests(supplier_profile_id, status, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_data_requests_company_status ON data_requests(company_id, status, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_emissions_supplier_created ON emissions(supplier_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_reminders_supplier_sent ON supplier_reminders(supplier_id, sent_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_documents_company_created ON supplier_documents(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_alerts_company_created ON intelligence_alerts(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_company_created ON intelligence_chat_messages(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_scores_company_calculated ON supplier_scores(company_id, calculated_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_scores_supplier_calculated ON supplier_scores(supplier_id, calculated_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_integrations_company ON integration_connections(company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_api_usage_key_created ON api_usage_logs(api_key_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_credit_listings_status ON carbon_credit_listings(status, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_credit_tx_buyer_created ON carbon_credit_transactions(buyer_company_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_usage_metering_company_period ON usage_metering(company_id, period_key)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_usage_aggregates_company_period ON usage_aggregates(company_id, period_key)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id, permission_key)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_permission_templates_company ON permission_templates(company_id, created_at DESC)`)

  await query(`ALTER TABLE company_supplier_links ADD COLUMN IF NOT EXISTS share_emissions BOOLEAN NOT NULL DEFAULT true`)
  await query(`UPDATE company_supplier_links SET status = 'accepted' WHERE status = 'active'`)
  await query(`ALTER TABLE supplier_profiles ADD COLUMN IF NOT EXISTS supplier_score NUMERIC(5,2) DEFAULT 0`)
  await query(`UPDATE supplier_profiles SET supplier_score = COALESCE(emission_score, 0) WHERE supplier_score IS NULL`)
  await query(`ALTER TABLE emissions ADD COLUMN IF NOT EXISTS supplier_profile_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL`)
  await query(`CREATE INDEX IF NOT EXISTS idx_emissions_supplier_profile ON emissions(supplier_profile_id) WHERE supplier_profile_id IS NOT NULL`)
  await query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'emissions' AND column_name = 'supplier_id' AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE emissions ALTER COLUMN supplier_id DROP NOT NULL;
      END IF;
    END $$;
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS supplier_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      token VARCHAR(64) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ,
      supplier_profile_id UUID REFERENCES supplier_profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      accepted_at TIMESTAMPTZ
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_invites_email_lower ON supplier_invites(LOWER(email))`)
  await query(`CREATE INDEX IF NOT EXISTS idx_supplier_invites_company ON supplier_invites(company_id, created_at DESC)`)
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invites_pending_email
    ON supplier_invites(company_id, LOWER(email))
    WHERE status = 'pending'
  `)

  await query(`
    CREATE OR REPLACE VIEW company_suppliers AS
    SELECT
      id,
      company_id,
      supplier_profile_id AS supplier_id,
      CASE
        WHEN status IN ('accepted', 'active') THEN 'accepted'
        WHEN status = 'pending' THEN 'pending'
        ELSE COALESCE(status, 'pending')
      END AS status,
      created_at,
      updated_at
    FROM company_supplier_links
  `)

  await query(`
    INSERT INTO industry_benchmarks (industry_key, metric_key, avg_value, unit) VALUES
      ('general', 'monthly_total_co2', 18000, 'kg'),
      ('general', 'supplier_avg_co2', 2200, 'kg'),
      ('manufacturing', 'monthly_total_co2', 26000, 'kg'),
      ('manufacturing', 'supplier_avg_co2', 3100, 'kg'),
      ('retail', 'monthly_total_co2', 12000, 'kg'),
      ('retail', 'supplier_avg_co2', 1600, 'kg'),
      ('technology', 'monthly_total_co2', 8000, 'kg'),
      ('technology', 'supplier_avg_co2', 1100, 'kg')
    ON CONFLICT (industry_key, metric_key)
    DO UPDATE SET avg_value = EXCLUDED.avg_value, updated_at = NOW()
  `)
  await query(`
    INSERT INTO compliance_frameworks (region_key, name, requirements) VALUES
      ('global', 'Global ESG Baseline', '["Scope reporting","Supplier traceability","Audit log retention"]'::jsonb),
      ('india', 'India BRSR / SEBI ESG', '["BRSR disclosures","Energy intensity","Supplier sustainability metrics"]'::jsonb),
      ('eu', 'EU CBAM / CSRD', '["CBAM declarations","Embedded emissions traceability","Scope 1-3 disclosures"]'::jsonb)
    ON CONFLICT (region_key) DO UPDATE SET name = EXCLUDED.name, requirements = EXCLUDED.requirements
  `)
  await query(`
    INSERT INTO subscription_plans (plan_key, name, monthly_price, included_api_calls, features, is_enterprise) VALUES
      ('starter', 'Starter', 99, 10000, '["Core dashboard","Supplier management","Basic reports"]'::jsonb, false),
      ('growth', 'Growth', 499, 100000, '["Advanced insights","Integrations","API access"]'::jsonb, false),
      ('enterprise', 'Enterprise', 2499, 1000000, '["SSO/RBAC","Custom compliance","Priority support"]'::jsonb, true)
    ON CONFLICT (plan_key) DO UPDATE
      SET monthly_price = EXCLUDED.monthly_price, included_api_calls = EXCLUDED.included_api_calls, features = EXCLUDED.features, is_enterprise = EXCLUDED.is_enterprise
  `)

  console.log('[DB] Schema ready.')
}

module.exports = { query, initDB }
