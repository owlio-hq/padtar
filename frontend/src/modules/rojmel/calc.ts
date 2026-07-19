// Client-side mirror of backend/app/modules/rojmel/engine.py — used only for
// instant live-preview totals while editing; the backend recomputes canonically on save.
import type { MoneyLine, SalesLine } from './types'

export function computeDay(salesLines: SalesLine[], incomeLines: MoneyLine[], expenseLines: MoneyLine[]) {
  const lines = salesLines.map((s) => ({
    ...s,
    total: s.rate * s.qty,
    net_pic: (s.opening_pic || 0) - (s.closing_pic || 0), // NET.PIC = opening − closing (can go negative)
  }))
  let factorySales = 0
  for (const line of lines) factorySales += line.total

  let totalIncome = factorySales
  for (const line of incomeLines) totalIncome += line.amount

  let totalExpense = 0
  for (const line of expenseLines) totalExpense += line.amount

  const cashOnHand = totalIncome - totalExpense

  return { lines, factorySales, totalIncome, totalExpense, cashOnHand }
}
