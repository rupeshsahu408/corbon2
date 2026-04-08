function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num))
}

function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function buildSupplierScores(suppliers) {
  if (!suppliers.length) return []
  const totals = suppliers.map((s) => Number(s.total_co2 || 0))
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = max - min || 1

  return suppliers.map((s) => {
    const emission = Number(s.total_co2 || 0)
    const normalizedEmission = (emission - min) / span
    const completionPenalty = s.status === 'completed' ? 0 : 15
    const score = clamp(100 - normalizedEmission * 70 - completionPenalty, 0, 100)
    const tier = score >= 75 ? 'best' : score >= 45 ? 'watch' : 'high-risk'

    return {
      supplierId: s.id,
      name: s.name,
      score: round(score),
      tier,
      totalCo2: round(emission),
      status: s.status,
      factors: {
        normalizedEmission: round(normalizedEmission),
        completionPenalty,
      },
    }
  }).sort((a, b) => b.score - a.score)
}

module.exports = { buildSupplierScores }
