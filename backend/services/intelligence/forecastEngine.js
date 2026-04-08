function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function linearProjection(values) {
  const n = values.length
  if (!n) return 0
  if (n === 1) return values[0]
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumXX += i * i
  }
  const denominator = n * sumXX - sumX * sumX || 1
  const slope = (n * sumXY - sumX * sumY) / denominator
  const intercept = (sumY - slope * sumX) / n
  return slope * n + intercept
}

function buildForecast(monthlyTotals) {
  const history = monthlyTotals.map((m) => ({ month: m.month, total: round(m.total) }))
  const values = history.map((h) => Number(h.total || 0))
  const movingAverage = values.length ? values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(values.length, 3) : 0
  const projected = linearProjection(values)
  const nextEstimate = round((movingAverage + projected) / 2)

  return {
    method: 'moving_average_plus_linear_trend',
    history,
    nextMonthEstimate: nextEstimate,
    confidence: values.length >= 6 ? 'medium' : 'low',
    reasoning: {
      sampleSize: values.length,
      movingAverage: round(movingAverage),
      linearProjection: round(projected),
    },
  }
}

module.exports = { buildForecast }
