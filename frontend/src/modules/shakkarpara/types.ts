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

export interface HistorySnapshot {
  id: number
  snapshot_at: string
  data: BatchInput
}
