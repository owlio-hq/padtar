// Client-side mirror of backend/app/modules/shakkarpara/engine.py — used only for
// instant live-preview totals while editing; the backend recomputes canonically on save.
import type { Ingredient, OilSit } from './types'

export function oilSitNet(oilSit: OilSit): number {
  return oilSit.nava_dabba + oilSit.juna_dabba + oilSit.toppa - oilSit.parat_malela
}

export function computeBatch(
  ingredients: Ingredient[],
  oilSit: OilSit | null,
  productionQty: number,
  extraPerUnit = 0,
) {
  const lines = ingredients.map((ing) => {
    const usage = ing.is_oil_vaprayel && oilSit ? oilSitNet(oilSit) : ing.usage
    return { ...ing, usage, total: ing.rate * usage }
  })
  let total = 0
  for (const line of lines) total += line.total
  const padtar = productionQty ? total / productionQty + extraPerUnit : null
  return { lines, total, padtar }
}
