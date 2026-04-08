const test = require('node:test')
const assert = require('node:assert/strict')

const { buildInsights } = require('../services/intelligence/insightEngine')
const { buildAlerts } = require('../services/intelligence/alertEngine')
const { buildForecast } = require('../services/intelligence/forecastEngine')
const { buildSupplierScores } = require('../services/intelligence/scoringEngine')
const { buildPeriodComparison } = require('../services/intelligence/periodComparisonEngine')
const { buildAssistantReply } = require('../services/intelligence/assistantEngine')

test('buildInsights returns concentration insight', () => {
  const insights = buildInsights({
    topSuppliers: [
      { name: 'A', total_co2: 70 },
      { name: 'B', total_co2: 20 },
      { name: 'C', total_co2: 10 },
    ],
    sourceBreakdown: [
      { key: 'electricity', label: 'Electricity', value: 90, share: 60 },
      { key: 'fuel', label: 'Fuel', value: 50, share: 33 },
      { key: 'transport', label: 'Transport', value: 10, share: 7 },
    ],
    monthlyTotals: [{ month: '2026-01', total: 100 }, { month: '2026-02', total: 120 }],
  })
  assert.equal(insights.length >= 2, true)
  assert.match(insights[0].title, /Top/)
})

test('buildForecast provides next month estimate', () => {
  const forecast = buildForecast([
    { month: '2026-01', total: 100 },
    { month: '2026-02', total: 110 },
    { month: '2026-03', total: 120 },
  ])
  assert.equal(typeof forecast.nextMonthEstimate, 'number')
  assert.equal(forecast.history.length, 3)
})

test('buildSupplierScores ranks suppliers descending', () => {
  const scores = buildSupplierScores([
    { id: '1', name: 'Low', status: 'completed', total_co2: 10 },
    { id: '2', name: 'High', status: 'completed', total_co2: 200 },
  ])
  assert.equal(scores.length, 2)
  assert.equal(scores[0].name, 'Low')
})

test('buildPeriodComparison computes delta and direction', () => {
  const comparison = buildPeriodComparison(
    { period: '2026-03', total: 100 },
    { period: '2026-02', total: 80 }
  )
  assert.equal(comparison.direction, 'up')
  assert.equal(comparison.delta, 20)
})

test('buildAlerts emits high-emission and spike alerts with reasoning', () => {
  process.env.ALERT_MONTHLY_CO2_THRESHOLD = '50000'
  const alerts = buildAlerts({
    monthlyTotals: [
      { month: '2026-02', total: 40000 },
      { month: '2026-03', total: 60000 },
    ],
    pendingSuppliers: { pendingCount: 0, overdueCount: 0 },
    supplierTotals: [],
    delayPatterns: { repeatedDelays: [] },
  })
  const thresholdAlert = alerts.find((a) => a.type === 'high_emission_threshold')
  const spikeAlert = alerts.find((a) => a.type === 'emissions_spike')
  assert.equal(thresholdAlert?.severity, 'critical')
  assert.match(thresholdAlert?.reasoning || '', /exceeded threshold/i)
  assert.equal(spikeAlert?.severity, 'warning')
  assert.match(spikeAlert?.reasoning || '', /increased/i)
})

test('buildAlerts emits repeated delay alert', () => {
  const alerts = buildAlerts({
    monthlyTotals: [],
    pendingSuppliers: { pendingCount: 3, overdueCount: 3 },
    supplierTotals: [],
    delayPatterns: { repeatedDelays: [{ id: 's1', name: 'Late One' }] },
  })
  const repeated = alerts.find((a) => a.type === 'repeated_supplier_delay')
  assert.equal(!!repeated, true)
})

test('assistant returns reduction guidance', () => {
  const reply = buildAssistantReply('How can I reduce emissions?', {
    sourceBreakdown: [{ key: 'transport', label: 'Transport', value: 100, share: 55 }],
    supplierScores: [{ name: 'A', tier: 'high-risk' }],
  })
  assert.match(reply.answer, /Transport|transport/)
  assert.equal(Array.isArray(reply.suggestions), true)
})

test('assistant infers follow-up intent from history', () => {
  const reply = buildAssistantReply('what about last month?', {
    history: [{ role: 'user', content: 'Which supplier is risky?' }],
    supplierScores: [{ name: 'Risky Co', tier: 'high-risk' }],
    sourceBreakdown: [],
    monthlyTotals: [{ month: '2026-01', total: 100 }],
  })
  assert.match(reply.answer, /risk|supplier/i)
})
