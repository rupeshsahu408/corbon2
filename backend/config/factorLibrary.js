/**
 * Single source of truth for numeric emission factors + versioned metadata (citations).
 * Calculator code imports EMISSION_FACTORS from here only.
 */
const FACTOR_LIBRARY_VERSION = 'cf-factors-2026.01'

const EMISSION_FACTORS = {
  fuel: {
    diesel: 2.68,
    petrol: 2.31,
    lpg: 1.51,
    natural_gas: 2.04,
  },
  electricity: 0.233,
  transport: 0.1,
}

const FACTOR_METADATA = {
  'fuel.diesel': {
    kgCo2PerUnit: 2.68,
    unit: 'L',
    ghgScope: '1',
    sourceLabel: 'Illustrative combustion factor (diesel)',
    reference: 'Typical DEFRA / national factor style; replace with jurisdiction-specific library in production',
    referenceYear: 2024,
  },
  'fuel.petrol': {
    kgCo2PerUnit: 2.31,
    unit: 'L',
    ghgScope: '1',
    sourceLabel: 'Illustrative combustion factor (petrol)',
    reference: 'Typical DEFRA / national factor style',
    referenceYear: 2024,
  },
  'fuel.lpg': {
    kgCo2PerUnit: 1.51,
    unit: 'L',
    ghgScope: '1',
    sourceLabel: 'Illustrative combustion factor (LPG)',
    reference: 'Typical DEFRA / national factor style',
    referenceYear: 2024,
  },
  'fuel.natural_gas': {
    kgCo2PerUnit: 2.04,
    unit: 'L-eq',
    ghgScope: '1',
    sourceLabel: 'Illustrative combustion factor (natural gas)',
    reference: 'Typical DEFRA / national factor style',
    referenceYear: 2024,
  },
  electricity_grid_average: {
    kgCo2PerKwh: EMISSION_FACTORS.electricity,
    ghgScope: '2',
    sourceLabel: 'Grid average electricity',
    reference: 'IEA / illustrative global average — replace with market-specific grid factors',
    referenceYear: 2023,
  },
  transport_road_freight: {
    kgCo2PerKm: EMISSION_FACTORS.transport,
    ghgScope: '3',
    sourceLabel: 'Road freight (distance-based proxy)',
    reference: 'Illustrative; replace with shipment-level or mode-specific factors',
    referenceYear: 2024,
  },
}

function getLineageModel() {
  return [
    {
      activityKey: 'supplier_electricity_kwh',
      label: 'Purchased electricity (supplier-reported)',
      ghgScope: '2',
      factorKey: 'electricity_grid_average',
      formula: 'kWh × factor kgCO2/kWh',
    },
    {
      activityKey: 'supplier_fuel_litres',
      label: 'Fuel combustion (supplier-reported)',
      ghgScope: '1',
      factorKey: 'fuel.{diesel|petrol|lpg|natural_gas}',
      formula: 'L × factor kgCO2/L',
    },
    {
      activityKey: 'supplier_transport_km',
      label: 'Transport (distance proxy)',
      ghgScope: '3',
      factorKey: 'transport_road_freight',
      formula: 'km × factor kgCO2/km',
    },
    {
      activityKey: 'company_direct_entry',
      label: 'Company direct Scope 1/2 entry',
      ghgScope: '1|2',
      factorKey: 'same as supplier + optional other_co2',
      formula: 'Manual / invoice-derived',
    },
  ]
}

function getPublicFactorDetails() {
  return {
    factorLibraryVersion: FACTOR_LIBRARY_VERSION,
    factors: FACTOR_METADATA,
    lineageModel: getLineageModel(),
  }
}

module.exports = {
  FACTOR_LIBRARY_VERSION,
  EMISSION_FACTORS,
  FACTOR_METADATA,
  getLineageModel,
  getPublicFactorDetails,
}
