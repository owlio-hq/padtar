import type { SalesLine } from './types'

// Mirrors backend/app/modules/rojmel/defaults.py — name first, size after.
export const DEFAULT_PRODUCTS: SalesLine[] = [
  { product: 'Salted Wafer 200g', rate: 40, qty: 0 },
  { product: 'Masala 200g', rate: 50, qty: 0 },
  { product: 'Salted Wafer 500g', rate: 100, qty: 0 },
  { product: 'Mitho Tikho', rate: 40, qty: 0 },
  { product: 'Yellow', rate: 60, qty: 0 },
  { product: 'Banana', rate: 50, qty: 0 },
  { product: 'Red Wafer', rate: 50, qty: 0 },
  { product: 'Salted Wafer 50g', rate: 10, qty: 0 },
  { product: 'Para 200g', rate: 30, qty: 0 },
  { product: 'Para 500g', rate: 80, qty: 0 },
]
