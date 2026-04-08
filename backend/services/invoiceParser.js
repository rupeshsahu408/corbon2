function normalizeDate(raw) {
  if (!raw) return null
  const text = String(raw).trim()

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch
    return `${yyyy}-${mm}-${dd}`
  }

  const monthMatch = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (monthMatch) {
    const [, dayRaw, monthRaw, yearRaw] = monthMatch
    const monthMap = {
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    }
    const month = monthMap[monthRaw.toLowerCase()]
    if (!month) return null
    const day = String(dayRaw).padStart(2, '0')
    return `${yearRaw}-${month}-${day}`
  }

  return null
}

function parseInvoiceText(text) {
  const raw = String(text || '')
  const compact = raw.replace(/,/g, '')

  const usagePatterns = [
    { regex: /(\d+(?:\.\d+)?)\s*kwh\b/gi, kind: 'kwh_suffix', base: 0.9 },
    { regex: /(\d+(?:\.\d+)?)\s*units?\b/gi, kind: 'units_suffix', base: 0.8 },
    { regex: /\bunits?\b[\s:]*?(\d+(?:\.\d+)?)/gi, kind: 'units_prefix', base: 0.72 },
    { regex: /\bconsumed\b[\s:]*?(\d+(?:\.\d+)?)/gi, kind: 'consumed_prefix', base: 0.7 },
  ]

  const candidateMap = new Map()
  for (const pattern of usagePatterns) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
    let match
    while ((match = regex.exec(compact)) !== null) {
      const units = Number(match[1])
      if (!Number.isFinite(units) || units <= 0) continue
      const existing = candidateMap.get(units)
      const score = Math.max(0.1, Math.min(0.99, pattern.base))
      if (!existing || score > existing.confidence) {
        candidateMap.set(units, {
          units,
          confidence: score,
          evidence: pattern.kind,
          raw_match: match[0],
        })
      }
    }
  }
  const candidates = Array.from(candidateMap.values()).sort((a, b) => b.confidence - a.confidence)
  const best = candidates[0] || null

  const datePatterns = [
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
    /\b(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/,
  ]

  let parsedDate = null
  for (const pattern of datePatterns) {
    const m = raw.match(pattern)
    if (m) {
      parsedDate = normalizeDate(m[1])
      if (parsedDate) break
    }
  }

  return {
    units: best ? Number(best.units) : null,
    confidence: best ? Number(best.confidence.toFixed(2)) : null,
    candidates: candidates.map((c) => ({
      units: c.units,
      confidence: Number(c.confidence.toFixed(2)),
      evidence: c.evidence,
    })),
    date: parsedDate,
  }
}

module.exports = { parseInvoiceText, normalizeDate }
