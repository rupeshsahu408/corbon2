const path = require('path')
const fs = require('fs')

const PACKS = {
  cdp: 'cdp-climate.json',
  esrs: 'esrs-e1-climate.json',
}

function loadPack(framework) {
  const key = String(framework || '').toLowerCase()
  const file = PACKS[key]
  if (!file) return null
  const full = path.join(__dirname, '..', 'disclosure-packs', file)
  const raw = fs.readFileSync(full, 'utf8')
  return JSON.parse(raw)
}

function pickStat(stats, key) {
  if (key === 'companyName') return stats.companyName
  const v = stats[key]
  return v == null ? null : Number(v)
}

function buildStructuredExport(framework, stats) {
  const pack = loadPack(framework)
  if (!pack) return null

  const datapoints = []
  for (const row of pack.mapping || []) {
    const raw = pickStat(stats, row.carbonflowStat)
    const base = {
      id: row.id,
      label: row.label,
      unit: row.unit,
      valueKgCo2e: typeof raw === 'number' ? raw : null,
      valueText: typeof raw === 'string' ? raw : null,
      notes: row.notes || null,
    }
    if (row.optionalTransform === 'tonnes' && typeof raw === 'number') {
      base.valueTonnesCo2e = Number((raw / 1000).toFixed(6))
    }
    if (row.cdpSection) base.cdpSection = row.cdpSection
    if (row.esrsParagraph) base.esrsParagraph = row.esrsParagraph
    datapoints.push(base)
  }

  return {
    framework: pack.framework,
    packVersion: pack.version,
    description: pack.description,
    generatedAt: new Date().toISOString(),
    organization: stats.companyName,
    datapoints,
    carbonflowEngine: stats.calculationEngineVersion,
    factorLibraryVersion: stats.factorLibraryVersion,
  }
}

module.exports = { buildStructuredExport, loadPack, PACKS }
