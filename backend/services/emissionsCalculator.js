const { EMISSION_FACTORS } = require('../config/factorLibrary')

function calculateCO2({ electricity_usage, fuel_usage, transport_distance, fuel_type = 'diesel' }) {
  const fuelFactor = EMISSION_FACTORS.fuel[fuel_type] || EMISSION_FACTORS.fuel.diesel
  const scope1 = parseFloat((parseFloat(fuel_usage) || 0) * fuelFactor)
  const scope2 = parseFloat((parseFloat(electricity_usage) || 0) * EMISSION_FACTORS.electricity)
  const scope3 = parseFloat((parseFloat(transport_distance) || 0) * EMISSION_FACTORS.transport)
  const total  = parseFloat((scope1 + scope2 + scope3).toFixed(4))
  return {
    total_co2:  total,
    scope1_co2: parseFloat(scope1.toFixed(4)),
    scope2_co2: parseFloat(scope2.toFixed(4)),
    scope3_co2: parseFloat(scope3.toFixed(4)),
  }
}

function calculateDirectCO2({ fuel_usage, fuel_type = 'diesel', electricity_usage, other_co2 = 0 }) {
  const fuelFactor = EMISSION_FACTORS.fuel[fuel_type] || EMISSION_FACTORS.fuel.diesel
  const scope1 = parseFloat(((parseFloat(fuel_usage) || 0) * fuelFactor + (parseFloat(other_co2) || 0)).toFixed(4))
  const scope2 = parseFloat(((parseFloat(electricity_usage) || 0) * EMISSION_FACTORS.electricity).toFixed(4))
  return {
    scope1_co2: scope1,
    scope2_co2: scope2,
    total_co2:  parseFloat((scope1 + scope2).toFixed(4)),
  }
}

module.exports = { calculateCO2, calculateDirectCO2, EMISSION_FACTORS }
