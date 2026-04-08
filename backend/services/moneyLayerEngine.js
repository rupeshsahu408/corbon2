/**
 * Phase C — simple rules: carbon cost, CBAM-style export risk, BRSR-style compliance gaps.
 * Levels: low | medium | high
 */

const CBAM_HIGH_CO2_KG = 50_000
const COST_HIGH_INR = 2_000_000
const PENDING_RATIO_HIGH = 0.45
const COMPLETION_LOW = 50
const COMPLETION_MED = 75

function tonnesFromKg(kg) {
  return kg / 1000
}

function carbonCostInr(totalKgCo2, priceInrPerTon) {
  return Number((tonnesFromKg(totalKgCo2) * priceInrPerTon).toFixed(2))
}

function levelRank(level) {
  if (level === 'high') return 3
  if (level === 'medium') return 2
  return 1
}

function maxLevel(a, b) {
  return levelRank(a) >= levelRank(b) ? a : b
}

function assessExportRisk({ exportsStatus, grandTotalKg }) {
  const exportOriented = exportsStatus === 'yes' || exportsStatus === 'planning'
  if (!exportOriented) {
    return {
      level: 'low',
      label: 'EU export exposure (CBAM-style)',
      detail: 'Not flagged as export-focused; monitor if you ship to the EU.',
      exportOriented: false,
    }
  }
  if (grandTotalKg >= CBAM_HIGH_CO2_KG) {
    return {
      level: 'high',
      label: 'EU Export Risk: High',
      detail: 'High reported emissions plus export activity — review embedded carbon reporting and potential CBAM levy exposure.',
      exportOriented: true,
    }
  }
  if (grandTotalKg >= CBAM_HIGH_CO2_KG * 0.4) {
    return {
      level: 'medium',
      label: 'EU Export Risk: Medium',
      detail: 'Exports to EU and moderate footprint — verify HS codes and emissions data for declarations.',
      exportOriented: true,
    }
  }
  return {
    level: 'low',
    label: 'EU Export Risk: Low',
    detail: 'Export-oriented but footprint below elevated threshold; keep records current.',
    exportOriented: true,
  }
}

function assessComplianceRisk({ completionPct, pendingRatio, scope3Kg, grandTotalKg, totalSuppliers }) {
  const missingScope3 = totalSuppliers > 0 && scope3Kg < grandTotalKg * 0.05 && grandTotalKg > 1000
  if (completionPct < COMPLETION_LOW || pendingRatio > PENDING_RATIO_HIGH || missingScope3) {
    return {
      level: 'high',
      label: 'Compliance Risk: High',
      detail: missingScope3
        ? 'Scope 3 coverage looks thin versus total footprint — BRSR-style disclosures may be challenged.'
        : 'Many suppliers still incomplete — regulatory data gaps increase disclosure risk.',
      gaps: {
        lowCompletion: completionPct < COMPLETION_LOW,
        highPendingRatio: pendingRatio > PENDING_RATIO_HIGH,
        thinScope3: missingScope3,
      },
    }
  }
  if (completionPct < COMPLETION_MED || pendingRatio > 0.25) {
    return {
      level: 'medium',
      label: 'Compliance Risk: Medium',
      detail: 'Close supplier data gaps before assurance cycles.',
      gaps: { lowCompletion: completionPct < COMPLETION_MED, highPendingRatio: pendingRatio > 0.25 },
    }
  }
  return {
    level: 'low',
    label: 'Compliance Risk: Low',
    detail: 'Coverage looks reasonable; keep Scope 3 submissions current.',
    gaps: {},
  }
}

function buildRecommendations({ exportRisk, complianceRisk, totalFuel, totalElectricity, grandTotalKg }) {
  const recs = []
  if (totalFuel > totalElectricity && totalFuel > 100) {
    recs.push({
      key: 'reduce_diesel',
      title: 'Reduce diesel and on-road fuel',
      detail: 'Fuel-linked Scope 1 is material — route optimization and fleet efficiency reduce cost and CBAM-relevant intensity.',
    })
  }
  if (exportRisk.level === 'high') {
    recs.push({
      key: 'eu_data',
      title: 'Tighten EU-bound product carbon records',
      detail: 'Prioritize supplier-specific data for goods you export to the EU.',
    })
  }
  if (complianceRisk.level !== 'low') {
    recs.push({
      key: 'scope3_data',
      title: 'Chase pending Scope 3 submissions',
      detail: 'Completing supplier forms improves BRSR readiness and lowers estimated liability ranges.',
    })
  }
  if (grandTotalKg > 0 && recs.length < 2) {
    recs.push({
      key: 'supplier_switch',
      title: 'Review high-emission suppliers',
      detail: 'Substituting or engaging lower-carbon suppliers compounds savings at your carbon price.',
    })
  }
  return recs.slice(0, 6)
}

function buildMoneyAlerts({
  company,
  costInr,
  costChangePct,
  exportRisk,
  complianceRisk,
}) {
  const alerts = []
  if (costInr >= COST_HIGH_INR) {
    alerts.push({
      type: 'money_high_carbon_cost',
      severity: 'warning',
      message: `Estimated carbon cost exceeds ₹${(COST_HIGH_INR / 100000).toFixed(1)}L at your internal price — review reduction levers.`,
      payload: { costInr, threshold: COST_HIGH_INR },
    })
  }
  if (costChangePct !== null && costChangePct > 12) {
    alerts.push({
      type: 'money_emissions_cost_rising',
      severity: 'warning',
      message: `Month-over-month estimated carbon cost up ~${costChangePct.toFixed(0)}% — trend worth investigating.`,
      payload: { costChangePct },
    })
  }
  if (exportRisk.level === 'high') {
    alerts.push({
      type: 'export_cbam_exposure',
      severity: 'warning',
      message: 'EU export exposure flagged as high — plan for potential tax and reporting burden.',
      payload: { level: exportRisk.level },
    })
  }
  if (complianceRisk.level === 'high') {
    alerts.push({
      type: 'compliance_br_sr_gap',
      severity: 'warning',
      message: complianceRisk.detail,
      payload: { level: complianceRisk.level },
    })
  }
  return alerts
}

module.exports = {
  carbonCostInr,
  tonnesFromKg,
  assessExportRisk,
  assessComplianceRisk,
  buildRecommendations,
  buildMoneyAlerts,
  maxLevel,
  CBAM_HIGH_CO2_KG,
  COST_HIGH_INR,
}
