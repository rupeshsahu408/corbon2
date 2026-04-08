function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function stdDev(values) {
  if (!values.length) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function buildAlerts({ monthlyTotals, pendingSuppliers, supplierTotals, delayPatterns }) {
  const alerts = []
  const highEmissionThreshold = Number(process.env.ALERT_MONTHLY_CO2_THRESHOLD || 50000)

  if (monthlyTotals.length) {
    const currentMonth = monthlyTotals[monthlyTotals.length - 1]
    const currentTotal = Number(currentMonth.total || 0)
    if (currentTotal > highEmissionThreshold) {
      alerts.push({
        type: 'high_emission_threshold',
        severity: 'critical',
        message: `Monthly emissions reached ${round(currentTotal)} kg CO2`,
        reasoning: `Total emissions exceeded threshold of ${round(highEmissionThreshold)} kg`,
        payload: {
          currentMonth: currentMonth.month,
          currentTotal: round(currentTotal),
          threshold: round(highEmissionThreshold),
        },
      })
    }
  }

  if (monthlyTotals.length >= 2) {
    const currentMonth = monthlyTotals[monthlyTotals.length - 1]
    const previousMonth = monthlyTotals[monthlyTotals.length - 2]
    const last = Number(currentMonth.total || 0)
    const prev = Number(previousMonth.total || 0)
    if (prev > 0) {
      const pct = ((last - prev) / prev) * 100
      if (pct >= 20) {
        alerts.push({
          type: 'emissions_spike',
          severity: 'warning',
          message: `Monthly emissions spiked by ${round(pct)}%`,
          reasoning: `Current month emissions increased by ${round(pct)}% compared with previous month`,
          payload: {
            currentMonth: currentMonth.month,
            previousMonth: previousMonth.month,
            lastMonthTotal: round(last),
            previousMonthTotal: round(prev),
            deltaPct: round(pct),
          },
        })
      }
    }
  }

  if (pendingSuppliers.overdueCount >= 2) {
    alerts.push({
      type: 'missing_supplier_data',
      severity: pendingSuppliers.overdueCount >= 5 ? 'high' : 'medium',
      message: `${pendingSuppliers.overdueCount} suppliers are overdue on data submission`,
      reasoning: `${pendingSuppliers.overdueCount} suppliers are pending for more than 5 days`,
      payload: { overdueCount: pendingSuppliers.overdueCount, pendingCount: pendingSuppliers.pendingCount },
    })
  }

  if ((delayPatterns?.repeatedDelays || []).length > 0) {
    alerts.push({
      type: 'repeated_supplier_delay',
      severity: 'warning',
      message: `${delayPatterns.repeatedDelays.length} supplier(s) repeatedly delayed data submissions`,
      reasoning: `These suppliers received multiple reminders and are still pending`,
      payload: {
        supplierIds: delayPatterns.repeatedDelays.map((s) => s.id),
        supplierNames: delayPatterns.repeatedDelays.map((s) => s.name),
      },
    })
  }

  if (supplierTotals.length >= 3) {
    const values = supplierTotals.map((r) => Number(r.total_co2 || 0))
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const threshold = mean + 2 * stdDev(values)
    const outliers = supplierTotals.filter((r) => Number(r.total_co2 || 0) > threshold)
    if (outliers.length) {
      alerts.push({
        type: 'abnormal_supplier_values',
        severity: 'medium',
        message: `${outliers.length} supplier(s) have unusually high emissions`,
        reasoning: `Outlier detection threshold is ${round(threshold)} kg based on supplier distribution`,
        payload: { threshold: round(threshold), supplierIds: outliers.map((o) => o.id) },
      })
    }
  }

  return alerts
}

module.exports = { buildAlerts }
