function round(value) {
  return Number(Number(value || 0).toFixed(2))
}

function normalize(text = '') {
  return String(text).toLowerCase()
}

function inferIntent(q, history = []) {
  const text = normalize(q)
  if (text.includes('reduce') || text.includes('reduction') || text.includes('cut emissions')) return 'reduce'
  if (text.includes('risky') || text.includes('risk supplier') || text.includes('high risk')) return 'risk'
  if (text.includes('increase') || text.includes('spike') || text.includes('why did emissions')) return 'increase'
  if (text.includes('forecast') || text.includes('next month') || text.includes('predict')) return 'forecast'

  const followUpSignals = ['what about', 'and', 'then', 'that', 'this', 'it', 'last month', 'previous month']
  const looksLikeFollowUp = followUpSignals.some((s) => text.includes(s))
  if (!looksLikeFollowUp) return null

  const lastUser = [...history].reverse().find((m) => m.role === 'user')
  if (!lastUser) return null
  const prev = normalize(lastUser.content)
  if (prev.includes('reduce') || prev.includes('reduction')) return 'reduce'
  if (prev.includes('risk')) return 'risk'
  if (prev.includes('increase') || prev.includes('spike')) return 'increase'
  if (prev.includes('forecast') || prev.includes('next month') || prev.includes('predict')) return 'forecast'
  return null
}

function answerForReduction(context) {
  const dominant = (context.sourceBreakdown || []).sort((a, b) => b.share - a.share)[0]
  const topRisk = (context.supplierScores || []).filter((s) => s.tier === 'high-risk').slice(0, 3)
  const tips = []
  if (dominant?.key === 'transport') tips.push('Reduce route distance and consolidate shipments for major suppliers.')
  if (dominant?.key === 'electricity') tips.push('Prioritize renewable electricity procurement and energy-efficiency upgrades.')
  if (dominant?.key === 'fuel') tips.push('Optimize fuel usage with preventive maintenance and better fleet utilization.')
  if (topRisk.length) tips.push(`Start reduction plans with: ${topRisk.map((s) => s.name).join(', ')}.`)
  if (!tips.length) tips.push('Maintain monthly monitoring and continue supplier engagement.')
  return {
    answer: `Focus first on ${dominant?.label || 'your largest source'} (${round(dominant?.share || 0)}% share). ${tips.join(' ')}`,
    suggestions: tips,
  }
}

function answerForRisk(context) {
  const risky = (context.supplierScores || []).filter((s) => s.tier === 'high-risk').slice(0, 5)
  if (!risky.length) {
    return {
      answer: 'No high-risk suppliers are currently flagged. Keep monitoring monthly submissions to maintain this.',
      suggestions: ['Continue monthly reviews', 'Track overdue suppliers'],
    }
  }
  return {
    answer: `Highest risk suppliers are ${risky.slice(0, 3).map((s) => s.name).join(', ')} due to high emissions and/or incomplete submissions.`,
    suggestions: [
      'Request updated data from risky suppliers this week',
      'Set supplier-level reduction targets',
      'Prioritize engagement with top 3 risk suppliers',
    ],
  }
}

function answerForIncrease(context) {
  const monthly = context.monthlyTotals || []
  if (monthly.length < 2) {
    return {
      answer: 'Not enough month-over-month history yet. Add at least two months of data to explain increases confidently.',
      suggestions: ['Collect one more monthly cycle', 'Ensure all suppliers submit on time'],
    }
  }
  const last = Number(monthly[monthly.length - 1].total || 0)
  const prev = Number(monthly[monthly.length - 2].total || 0)
  const pct = prev > 0 ? round(((last - prev) / prev) * 100) : 0
  const top3 = (context.topSuppliers || []).slice(0, 3).map((s) => s.name).join(', ')
  return {
    answer: `Emissions changed ${pct}% vs last month (${round(prev)} -> ${round(last)} kg CO2). Likely drivers include top contributors: ${top3 || 'N/A'}.`,
    suggestions: [
      'Review latest submissions from top contributors',
      'Check transport and fuel spikes in new entries',
      'Compare direct emissions entries month-over-month',
    ],
  }
}

function buildAssistantReply(question, context) {
  const q = normalize(question)
  const intent = inferIntent(q, context.history || [])
  if (!q.trim()) {
    return {
      answer: 'Ask me about reductions, risky suppliers, emission increases, forecasts, or recommendations.',
      suggestions: ['How can I reduce emissions?', 'Which supplier is risky?', 'Why did emissions increase?'],
    }
  }
  if (intent === 'reduce') return answerForReduction(context)
  if (intent === 'risk') return answerForRisk(context)
  if (intent === 'increase') return answerForIncrease(context)
  if (intent === 'forecast') {
    const estimate = round(context.forecast?.nextMonthEstimate || 0)
    return {
      answer: `Projected next month emissions are about ${estimate} kg CO2 based on recent trend and moving-average projection.`,
      suggestions: ['Track top contributors weekly', 'Set monthly reduction target below forecast'],
    }
  }
  return {
    answer: 'I can help with emission reductions, risky suppliers, trend explanations, forecast, and practical recommendations.',
    suggestions: ['How can I reduce emissions?', 'Which supplier is risky?', 'What should I do this month?'],
  }
}

module.exports = { buildAssistantReply }
