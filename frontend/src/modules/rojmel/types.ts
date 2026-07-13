export interface SalesLine {
  id?: number
  product: string
  rate: number
  qty: number
  total?: number
}

export interface MoneyLine {
  id?: number
  description: string
  amount: number
  note: string
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
