function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function buildInsights({ topSuppliers, sourceBreakdown, monthlyTotals }) {
  const insights = []

  if (topSuppliers.length) {
    const total = topSuppliers.reduce((acc, row) => acc + Number(row.total_co2 || 0), 0)
    const top3 = topSuppliers.slice(0, 3)
    const top3Total = top3.reduce((acc, row) => acc + Number(row.total_co2 || 0), 0)
    const pct = total > 0 ? round((top3Total / total) * 100) : 0
    insights.push({
      key: 'top_supplier_concentration',
      severity: pct >= 60 ? 'high' : pct >= 40 ? 'medium' : 'low',
      title: `Top ${top3.length} suppliers contribute ${pct}% of supplier emissions`,
      detail: top3.map((s) => `${s.name} (${round(s.total_co2)} kg)`).join(', '),
      reasoning: { top3Percentage: pct, supplierCount: topSuppliers.length },
    })
  }

  const dominant = sourceBreakdown.reduce((best, cur) => (cur.value > best.value ? cur : best), { key: 'none', value: 0 })
  if (dominant.value > 0) {
    insights.push({
      key: 'dominant_emission_source',
      severity: dominant.share >= 50 ? 'high' : 'medium',
      title: `${dominant.label} is the largest contributor`,
      detail: `${round(dominant.value)} kg CO2 (${round(dominant.share)}% of total)`,
      reasoning: { source: dominant.key, share: round(dominant.share) },
    })
  }

  if (monthlyTotals.length >= 2) {
    const last = Number(monthlyTotals[monthlyTotals.length - 1].total || 0)
    const prev = Number(monthlyTotals[monthlyTotals.length - 2].total || 0)
    const deltaPct = prev > 0 ? round(((last - prev) / prev) * 100) : 0
    insights.push({
      key: 'trend_direction',
      severity: deltaPct > 15 ? 'high' : deltaPct > 5 ? 'medium' : 'low',
      title: deltaPct >= 0 ? `Emissions up ${deltaPct}% month-over-month` : `Emissions down ${Math.abs(deltaPct)}% month-over-month`,
      detail: `Latest month: ${round(last)} kg vs previous month: ${round(prev)} kg`,
      reasoning: { lastMonth: round(last), previousMonth: round(prev), deltaPct },
    })
  }

  const transportShare = sourceBreakdown.find((s) => s.key === 'transport')?.share || 0
  if (transportShare >= 30) {
    insights.push({
      key: 'transport_rising_signal',
      severity: transportShare >= 45 ? 'high' : 'medium',
      title: 'Transport emissions are a significant contributor',
      detail: `Transport currently contributes ${round(transportShare)}% of total measured sources.`,
      reasoning: { transportShare: round(transportShare) },
    })
  }

  return insights
}

module.exports = { buildInsights }
