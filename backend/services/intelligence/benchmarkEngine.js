function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function buildBenchmarkComparison({ companyIndustry, benchmarks, monthlyTotals, supplierScores }) {
  const latestMonth = Number(monthlyTotals[monthlyTotals.length - 1]?.total || 0)
  const avgSupplierCo2 = supplierScores.length
    ? supplierScores.reduce((acc, s) => acc + Number(s.totalCo2 || 0), 0) / supplierScores.length
    : 0

  const lookup = (metricKey) => benchmarks.find((b) => b.metric_key === metricKey)
  const monthlyRef = lookup('monthly_total_co2')
  const supplierRef = lookup('supplier_avg_co2')

  const monthlyDeltaPct = monthlyRef?.avg_value
    ? round(((latestMonth - Number(monthlyRef.avg_value)) / Number(monthlyRef.avg_value)) * 100)
    : 0
  const supplierDeltaPct = supplierRef?.avg_value
    ? round(((avgSupplierCo2 - Number(supplierRef.avg_value)) / Number(supplierRef.avg_value)) * 100)
    : 0

  return {
    industry: companyIndustry || 'general',
    monthlyTotal: {
      companyValue: round(latestMonth),
      benchmarkValue: round(monthlyRef?.avg_value || 0),
      deltaPct: monthlyDeltaPct,
      status: monthlyDeltaPct > 0 ? 'above' : 'below',
    },
    supplierAverage: {
      companyValue: round(avgSupplierCo2),
      benchmarkValue: round(supplierRef?.avg_value || 0),
      deltaPct: supplierDeltaPct,
      status: supplierDeltaPct > 0 ? 'above' : 'below',
    },
  }
}

module.exports = { buildBenchmarkComparison }
