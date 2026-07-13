import type { Ingredient, OilSit } from './types'

// Mirrors backend/app/modules/shakkarpara/defaults.py — categories + order.
// These are only the fallback for a brand-new form before the editable defaults
// load from the API; the real defaults come from GET /shakkarpara/default-ingredients.
export const DEFAULT_INGREDIENTS: Ingredient[] = [
  { name: 'Menda', category: 'Raw Material', rate: 890, usage: 0, unit: 'Katta', is_oil_vaprayel: false },
  { name: 'Elaichi', category: 'Raw Material', rate: 3000, usage: 0, unit: 'Gram', is_oil_vaprayel: false },
  { name: 'Sugar', category: 'Raw Material', rate: 43, usage: 0, unit: 'Kg', is_oil_vaprayel: false },
  { name: 'Ghee', category: 'Raw Material', rate: 160, usage: 0, unit: 'Kg', is_oil_vaprayel: false },
  { name: 'Masala', category: 'Raw Material', rate: 350, usage: 0, unit: 'Potli', is_oil_vaprayel: false },
  { name: 'Oil', category: 'Cooking/Frying', rate: 2350, usage: 0, unit: 'Lot Bandhta', is_oil_vaprayel: false },
  { name: 'Oil Vaprayel', category: 'Cooking/Frying', rate: 2350, usage: 0, unit: 'Dabba', is_oil_vaprayel: true },
  { name: 'Pelet', category: 'Fuel', rate: 15.25, usage: 0, unit: 'Kg', is_oil_vaprayel: false },
  { name: 'Box & Plastic', category: 'Packaging', rate: 20, usage: 0, unit: 'Pic', is_oil_vaprayel: false },
  { name: 'Worker', category: 'Worker', rate: 550, usage: 0, unit: 'Per Day', is_oil_vaprayel: false },
]

export const DEFAULT_OIL_SIT: OilSit = { nava_dabba: 0, juna_dabba: 0, toppa: 0, parat_malela: 0 }
