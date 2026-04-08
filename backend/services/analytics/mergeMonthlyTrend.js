function toMonthKey(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return null
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Merge monthly trend rows across sources into a single month bucket.
 *
 * Expected input row shape:
 * - month_date: Date | date-string
 * - total_co2, scope1_co2, scope2_co2, scope3_co2: number-like
 *
 * Output shape matches frontend expectation:
 * - { month: 'YYYY-MM', co2, scope1, scope2, scope3 }
 */
function mergeMonthlyTrend({ supplierRows = [], sharedRows = [], directRows = [], limit = 12 } = {}) {
  const byKey = new Map()

  function addRow(r) {
    const key = toMonthKey(r?.month_date)
    if (!key) return
    const prev = byKey.get(key) || { month: key, month_date: new Date(`${key}-01T00:00:00Z`), co2: 0, scope1: 0, scope2: 0, scope3: 0 }
    prev.co2 += Number(r?.total_co2 || 0)
    prev.scope1 += Number(r?.scope1_co2 || 0)
    prev.scope2 += Number(r?.scope2_co2 || 0)
    prev.scope3 += Number(r?.scope3_co2 || 0)
    byKey.set(key, prev)
  }

  supplierRows.forEach(addRow)
  sharedRows.forEach(addRow)
  directRows.forEach(addRow)

  return Array.from(byKey.values())
    .sort((a, b) => a.month_date - b.month_date)
    .slice(-limit)
    .map((r) => ({
      month: r.month,
      co2: Number(r.co2.toFixed(4)),
      scope1: Number(r.scope1.toFixed(4)),
      scope2: Number(r.scope2.toFixed(4)),
      scope3: Number(r.scope3.toFixed(4)),
    }))
}

module.exports = { mergeMonthlyTrend }

