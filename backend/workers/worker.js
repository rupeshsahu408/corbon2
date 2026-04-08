require('dotenv').config()
const { createWorker } = require('../services/queue')
const { query } = require('../models/db')
const { executeIntegrationSync } = require('../services/integrationSync')

function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function aggregateUsage(companyId, periodKey) {
  const result = await query(
    `SELECT metric_key, COALESCE(SUM(quantity),0) AS total
     FROM usage_metering
     WHERE company_id = $1 AND period_key = $2
     GROUP BY metric_key`,
    [companyId, periodKey]
  )
  for (const row of result.rows) {
    await query(
      `INSERT INTO usage_aggregates (company_id, period_key, metric_key, total_quantity, calculated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (company_id, period_key, metric_key)
       DO UPDATE SET total_quantity = EXCLUDED.total_quantity, calculated_at = NOW()`,
      [companyId, periodKey, row.metric_key, row.total]
    )
  }
}

function start() {
  const integrationWorker = createWorker('integration-sync', async (job) => {
    const { companyId, connectionId } = job.data
    const result = await executeIntegrationSync(companyId, connectionId)
    return { ok: true, ...result }
  })

  const billingWorker = createWorker('billing-aggregate', async (job) => {
    const { companyId, periodKey } = job.data
    await aggregateUsage(companyId, periodKey)
    return { ok: true }
  })

  if (!integrationWorker || !billingWorker) {
    console.log('[Worker] REDIS_URL not set; workers disabled.')
    return
  }
  console.log('[Worker] Started integration-sync and billing-aggregate workers.')
}

start()

