export interface SalesLine {
  id?: number
  product: string
  rate: number
  qty: number
  opening_pic: number // OPP.PIC — morning count (typed)
  closing_pic: number // CLO.PIC — evening count (typed)
  total?: number
  net_pic?: number // NET.PIC = opening - closing (derived, can be negative)
}

export interface MoneyLine {
  id?: number
  description: string
  amount: number
  note: string
}

export interface CarryForwardLine {
  id?: number
  name: string
  amount: number
}

export interface Day {
  id: number
  date: string
  notes: string | null
  created_at: string
  updated_at: string
  sales_lines: Required<SalesLine>[]
  income_lines: Required<MoneyLine>[]
  expense_lines: Required<MoneyLine>[]
  carry_forward_lines: Required<CarryForwardLine>[]
  factory_sales: number
  total_income: number
  total_expense: number
  cash_on_hand: number
}

export interface DayInput {
  date: string
  notes: string | null
  sales_lines: SalesLine[]
  income_lines: MoneyLine[]
  expense_lines: MoneyLine[]
  carry_forward_lines: CarryForwardLine[]
}

export interface HistorySnapshot {
  id: number
  snapshot_at: string
  data: DayInput
}

export interface StockRow {
  id: number
  year: number
  month: number
  product: string
  rate: number
  opening_pic: number
  closing_pic: number
  net_pic: number
}
