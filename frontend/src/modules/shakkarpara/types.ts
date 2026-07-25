export interface Ingredient {
  id?: number
  name: string
  category: string
  rate: number
  usage: number
  unit: string
  is_oil_vaprayel: boolean
  total?: number
}

// The 5 fixed category groups, in display order.
export const CATEGORY_ORDER = ['Raw Material', 'Cooking/Frying', 'Fuel', 'Packaging', 'Worker'] as const

export interface OilSit {
  nava_dabba: number
  juna_dabba: number
  toppa: number
  parat_malela: number
  net_vaprash?: number
}

export interface Batch {
  id: number
  date: string
  production_qty: number
  production_unit: string
  extra_per_unit: number
  notes: string | null
  created_at: string
  updated_at: string
  ingredients: Required<Ingredient>[]
  oil_sit: OilSit | null
  total: number
  padtar: number | null
}

export interface BatchInput {
  date: string
  production_qty: number
  production_unit: string
  extra_per_unit: number
  notes: string | null
  ingredients: Ingredient[]
  oil_sit: OilSit | null
}

/**
 * One row of the "last N batches" reference strip on the batch form.
 *
 * Both oil rates are carried: they are two independently typed cells (only Oil
 * Vaprayel's *usage* is auto-filled from the Oil Sheet, never its rate) and they
 * differ on ~27% of the client's real historical sheets.
 * Any field is null when that ingredient row isn't on the batch.
 */
export interface BatchRecap {
  id: number
  date: string
  oil_rate: number | null
  oil_vaprayel_rate: number | null
  menda_rate: number | null
  menda_katta: number | null
  production_qty: number
  padtar: number | null
}

export interface HistorySnapshot {
  id: number
  snapshot_at: string
  data: BatchInput
}
