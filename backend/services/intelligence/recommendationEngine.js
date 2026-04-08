function buildRecommendations({ sourceBreakdown, alerts, supplierScores }) {
  const recs = []
  const dominant = sourceBreakdown.reduce((best, item) => (item.value > best.value ? item : best), { key: 'none', value: 0, share: 0 })

  if (dominant.key === 'transport') {
    recs.push({
      key: 'transport_optimization',
      title: 'Reduce transport distance for high-impact suppliers',
      impact: 'high',
      action: 'Consolidate shipments, shift to lower-emission routes, and prioritize regional suppliers.',
      reasoning: { dominantSource: 'transport', share: dominant.share },
    })
  }

  if (dominant.key === 'fuel') {
    recs.push({
      key: 'fuel_efficiency',
      title: 'Address fuel-related Scope 1 intensity',
      impact: 'high',
      action: 'Audit fleet and stationary combustion, shift to lower-carbon fuels where feasible, and validate supplier fuel data.',
      reasoning: { dominantSource: 'fuel', share: dominant.share },
    })
  }

  if (dominant.key === 'electricity') {
    recs.push({
      key: 'renewable_electricity',
      title: 'Shift electricity usage toward renewable sources',
      impact: 'high',
      action: 'Encourage suppliers to procure renewable electricity or improve energy efficiency in operations.',
      reasoning: { dominantSource: 'electricity', share: dominant.share },
    })
  }

  const spikeAlert = alerts.find((a) => a.type === 'emissions_spike')
  if (spikeAlert) {
    recs.push({
      key: 'spike_investigation',
      title: 'Investigate month-over-month emissions spike',
      impact: 'medium',
      action: 'Review recent supplier submissions and direct emissions entries for sudden activity changes.',
      reasoning: spikeAlert.payload,
    })
  }

  const highRisk = supplierScores.filter((s) => s.tier === 'high-risk')
  if (highRisk.length) {
    recs.push({
      key: 'supplier_rebalancing',
      title: 'Prioritize improvement plans for high-risk suppliers',
      impact: 'medium',
      action: `Launch action plans with ${highRisk.slice(0, 3).map((s) => s.name).join(', ')} and set quarterly reduction targets.`,
      reasoning: { highRiskCount: highRisk.length },
    })
  }

  if (!recs.length) {
    recs.push({
      key: 'maintain_performance',
      title: 'Maintain current reduction momentum',
      impact: 'low',
      action: 'Continue monthly monitoring and supplier engagement to sustain emissions improvements.',
      reasoning: {},
    })
  }

  return recs
}

module.exports = { buildRecommendations }
