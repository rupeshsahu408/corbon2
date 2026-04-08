const { EMISSION_FACTORS, FACTOR_LIBRARY_VERSION } = require('./factorLibrary')

const CALCULATION_ENGINE_VERSION = 'cf-2026.04.1'

function getPublicMethodology() {
  return {
    calculationEngineVersion: CALCULATION_ENGINE_VERSION,
    factorLibraryVersion: FACTOR_LIBRARY_VERSION,
    lastReviewed: '2026-04-08',
    protocol:
      'GHG Protocol Corporate Standard and Corporate Value Chain (Scope 3) — CarbonFlow maps activity to scopes per factors below.',
    scopes: {
      scope1:
        'Direct emissions from fuel combustion (supplier and company direct entries). Scope 1 CO₂ from fuel uses configured emission factors.',
      scope2:
        'Indirect emissions from purchased electricity (kWh × grid factor).',
      scope3:
        'Indirect supply-chain: transport activity (km × factor) and other supplier-reported allocations stored as Scope 3 where applicable.',
    },
    emissionFactors: {
      electricityKgCo2PerKwh: EMISSION_FACTORS.electricity,
      transportKgCo2PerKm: EMISSION_FACTORS.transport,
      fuelKgCo2PerUnitByType: { ...EMISSION_FACTORS.fuel },
      fuelDefaultType: 'diesel',
      units: {
        electricity: 'kWh',
        fuel: 'L (or litre-equivalent for natural gas)',
        transport: 'km',
      },
    },
    sourceAttribution:
      'Dashboard “source” shares are kg CO₂e: Fuel = Scope 1 total, Electricity = Scope 2 total, Transport = Scope 3 total (including shared network data where visibility flags allow).',
    documentation: {
      interactiveDocsUrl: '/api/docs',
      publicApiBasePath: '/api/public/v1',
    },
  }
}

module.exports = {
  CALCULATION_ENGINE_VERSION,
  getPublicMethodology,
}
