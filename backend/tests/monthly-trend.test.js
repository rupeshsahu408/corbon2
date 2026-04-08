const test = require('node:test')
const assert = require('node:assert/strict')
const { mergeMonthlyTrend } = require('../services/analytics/mergeMonthlyTrend')

test('mergeMonthlyTrend merges supplier + shared + direct by month key', () => {
  const supplierRows = [
    { month_date: '2026-01-15T10:00:00Z', total_co2: 10, scope1_co2: 1, scope2_co2: 2, scope3_co2: 7 },
    { month_date: '2026-02-02T10:00:00Z', total_co2: 20, scope1_co2: 2, scope2_co2: 3, scope3_co2: 15 },
  ]
  const sharedRows = [
    { month_date: '2026-02-01', total_co2: 5, scope1_co2: 0, scope2_co2: 1, scope3_co2: 4 },
  ]
  const directRows = [
    { month_date: '2026-01-05T08:00:00Z', total_co2: 3, scope1_co2: 3, scope2_co2: 0, scope3_co2: 0 },
  ]

  const merged = mergeMonthlyTrend({ supplierRows, sharedRows, directRows, limit: 12 })
  assert.deepEqual(merged.map((r) => r.month), ['2026-01', '2026-02'])

  const jan = merged[0]
  assert.equal(jan.co2, 13)
  assert.equal(jan.scope1, 4)
  assert.equal(jan.scope2, 2)
  assert.equal(jan.scope3, 7)

  const feb = merged[1]
  assert.equal(feb.co2, 25)
  assert.equal(feb.scope1, 2)
  assert.equal(feb.scope2, 4)
  assert.equal(feb.scope3, 19)
})

test('mergeMonthlyTrend sorts chronologically and applies limit', () => {
  const supplierRows = [
    { month_date: '2026-01-01', total_co2: 1, scope1_co2: 0, scope2_co2: 0, scope3_co2: 1 },
    { month_date: '2026-02-01', total_co2: 1, scope1_co2: 0, scope2_co2: 0, scope3_co2: 1 },
    { month_date: '2026-03-01', total_co2: 1, scope1_co2: 0, scope2_co2: 0, scope3_co2: 1 },
  ]
  const merged = mergeMonthlyTrend({ supplierRows, limit: 2 })
  assert.deepEqual(merged.map((r) => r.month), ['2026-02', '2026-03'])
})

