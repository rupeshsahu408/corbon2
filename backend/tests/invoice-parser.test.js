const test = require('node:test')
const assert = require('node:assert/strict')
const { parseInvoiceText, normalizeDate } = require('../services/invoiceParser')

test('extracts kWh and slash date', () => {
  const parsed = parseInvoiceText('Energy consumed 1200 kWh Bill Date: 05/03/2026')
  assert.equal(parsed.units, 1200)
  assert.equal(parsed.date, '2026-03-05')
  assert.equal(Array.isArray(parsed.candidates), true)
  assert.equal(parsed.candidates.length > 0, true)
})

test('extracts units pattern', () => {
  const parsed = parseInvoiceText('Total units 875 for this cycle')
  assert.equal(parsed.units, 875)
})

test('returns multiple candidates sorted by confidence', () => {
  const parsed = parseInvoiceText('Previous 900 units, this month consumed 1200 kWh')
  assert.equal(parsed.candidates.length >= 2, true)
  assert.equal(parsed.candidates[0].units, 1200)
})

test('normalizes month date format', () => {
  assert.equal(normalizeDate('5 March 2026'), '2026-03-05')
})
