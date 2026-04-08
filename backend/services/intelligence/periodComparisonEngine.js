function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function buildPeriodComparison(current, previous) {
  const currentTotal = Number(current?.total || 0)
  const previousTotal = Number(previous?.total || 0)
  const delta = currentTotal - previousTotal
  const deltaPct = previousTotal > 0 ? (delta / previousTotal) * 100 : 0

  return {
    current: {
      period: current?.period || '',
      total: round(currentTotal),
    },
    previous: {
      period: previous?.period || '',
      total: round(previousTotal),
    },
    delta: round(delta),
    deltaPct: round(deltaPct),
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  }
}

module.exports = { buildPeriodComparison }
