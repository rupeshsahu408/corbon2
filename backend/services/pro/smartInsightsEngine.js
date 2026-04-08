function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

function pct(numer, denom, digits = 2) {
  const d = Number(denom || 0)
  if (d <= 0) return 0
  return Number(((Number(numer || 0) / d) * 100).toFixed(digits))
}

function threeMonthTrendDirection(monthlyTrend = []) {
  if (!Array.isArray(monthlyTrend) || monthlyTrend.length < 3) {
    return { available: false, direction: 'insufficient', deltaPct: 0 }
  }

  const last3 = monthlyTrend.slice(-3).map((m) => Number(m?.co2 || m?.total || 0))
  const [a, b, c] = last3
  const rising = a < b && b < c
  const falling = a > b && b > c
  const direction = rising ? 'increasing' : falling ? 'decreasing' : 'stable'
  const deltaPct = a > 0 ? ((c - a) / a) * 100 : 0

  return { available: true, direction, deltaPct: round(deltaPct, 1), first: round(a, 2), last: round(c, 2) }
}

function dominantSource(sourceBreakdown = []) {
  if (!Array.isArray(sourceBreakdown) || !sourceBreakdown.length) {
    return { key: 'none', label: 'Source', value: 0, share: 0 }
  }
  return sourceBreakdown.reduce(
    (best, cur) => (Number(cur?.value || 0) > Number(best?.value || 0) ? cur : best),
    { key: 'none', label: 'Source', value: 0, share: 0 }
  )
}

function fuelRiskSignal({ sourceBreakdown = [], totalEmissionsKg = 0, topSuppliers = [] }) {
  const dominant = dominantSource(sourceBreakdown)
  const fuelShare = Number((sourceBreakdown.find((s) => s.key === 'fuel') || {}).share || 0)
  const defaultThreshold = 10000
  const threshold = Number(process.env.PRO_FUEL_RISK_TOTAL_THRESHOLD_KG || defaultThreshold)
  const fuelDominant = dominant.key === 'fuel'
  const highTotal = Number(totalEmissionsKg || 0) >= threshold
  const topSupplier = Array.isArray(topSuppliers) && topSuppliers.length ? topSuppliers[0] : null

  return {
    fuelDominant,
    highTotal,
    fuelShare: round(fuelShare, 1),
    thresholdKg: threshold,
    topSupplierName: topSupplier?.name || null,
    topSupplierPct: round(Number(topSupplier?.contributionPctOfGrandTotal || 0), 1),
    triggered: fuelDominant && highTotal,
  }
}

function buildCompanyInsights({ monthlyTrend = [], topSuppliers = [], sourceBreakdown = [], grandTotalKg = 0 }) {
  const insights = []

  if (Array.isArray(topSuppliers) && topSuppliers.length) {
    const top1 = topSuppliers[0]
    const top3Total = topSuppliers.slice(0, 3).reduce((acc, s) => acc + Number(s.totalEmissionsKg || 0), 0)
    insights.push(
      `Top supplier ${top1.name} contributes ${round(Number(top1.contributionPctOfGrandTotal || 0), 1)}% of total emissions; top 3 contribute ${round(pct(top3Total, grandTotalKg), 1)}%.`
    )
  }

  const fuelRisk = fuelRiskSignal({
    sourceBreakdown,
    totalEmissionsKg: grandTotalKg,
    topSuppliers,
  })
  if (fuelRisk.triggered) {
    insights.push(
      `Fuel cost/emission risk is high: fuel contributes ${fuelRisk.fuelShare}% and total emissions are above ${round(fuelRisk.thresholdKg, 0)} kg.`
    )
  }

  const trend = threeMonthTrendDirection(monthlyTrend)
  if (trend.available) {
    if (trend.direction === 'increasing') {
      insights.push(`Last 3 months trend is increasing (${trend.deltaPct}% net).`)
    } else if (trend.direction === 'decreasing') {
      insights.push(`Last 3 months trend is decreasing (${Math.abs(trend.deltaPct)}% net).`)
    } else {
      insights.push(`Last 3 months trend is stable/volatile (${trend.deltaPct}% net change).`)
    }
  }

  return insights
}

function buildSupplierInsights({
  supplierTotals = {},
  supplierTrend = [],
  supplierLatest = null,
  companyAverages = {},
  grandTotalKg = 0,
  supplierName = 'Supplier',
}) {
  const insights = []
  const supplierTotal = Number(supplierTotals.totalCo2Kg || supplierTotals.total_co2 || 0)
  const supplierContribution = pct(supplierTotal, grandTotalKg, 1)

  insights.push(`${supplierName} contributes ${supplierContribution}% of total emissions.`)

  const scope1 = Number(supplierTotals.scope1Kg || supplierTotals.scope1_co2 || 0)
  const scope2 = Number(supplierTotals.scope2Kg || supplierTotals.scope2_co2 || 0)
  const scope3 = Number(supplierTotals.scope3Kg || supplierTotals.scope3_co2 || 0)
  const dominant = [
    { key: 'fuel', label: 'Fuel', value: scope1 },
    { key: 'electricity', label: 'Electricity', value: scope2 },
    { key: 'transport', label: 'Transport', value: scope3 },
  ].sort((a, b) => b.value - a.value)[0]
  insights.push(`${dominant.label} is the dominant category for this supplier.`)

  const fuel = Number(supplierLatest?.fuel_usage || supplierLatest?.fuelLiters || 0)
  const avgFuel = Number(companyAverages?.avg_fuel || 0)
  if (avgFuel > 0) {
    const ratio = fuel / avgFuel
    if (ratio >= 1.5) {
      insights.push(`Fuel usage is unusually high (${round(ratio, 2)}x company average).`)
    }
  }

  const trend = threeMonthTrendDirection(supplierTrend)
  if (trend.available) {
    if (trend.direction === 'increasing') insights.push(`Last 3 months trend is increasing (${trend.deltaPct}% net).`)
    else if (trend.direction === 'decreasing') insights.push(`Last 3 months trend is decreasing (${Math.abs(trend.deltaPct)}% net).`)
    else insights.push(`Last 3 months trend is stable/volatile (${trend.deltaPct}% net change).`)
  }

  return insights
}

module.exports = {
  buildCompanyInsights,
  buildSupplierInsights,
  threeMonthTrendDirection,
  fuelRiskSignal,
}

