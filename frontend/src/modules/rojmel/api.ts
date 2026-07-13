import { api } from '../../api/client'
import type { Day, DayInput, HistorySnapshot, StockRow } from './types'

const BASE = '/rojmel'

export const rojmelApi = {
  list: (params?: { year?: number; month?: number }) => {
    const qs = new URLSearchParams()
    if (params?.year) qs.set('year', String(params.year))
    if (params?.month) qs.set('month', String(params.month))
    const suffix = qs.toString() ? `?${qs}` : ''
    return api.get<Day[]>(`${BASE}/days${suffix}`)
  },
  get: (id: number) => api.get<Day>(`${BASE}/days/${id}`),
  create: (data: DayInput) => api.post<Day>(`${BASE}/days`, data),
  update: (id: number, data: DayInput) => api.put<Day>(`${BASE}/days/${id}`, data),
  remove: (id: number) => api.delete(`${BASE}/days/${id}`),
  history: (id: number) => api.get<HistorySnapshot[]>(`${BASE}/days/${id}/history`),
  undo: (id: number) => api.post<Day>(`${BASE}/days/${id}/undo`),
  stock: (year: number, month: number) => api.get<StockRow[]>(`${BASE}/stock?year=${year}&month=${month}`),
  updateStock: (id: number, data: { rate?: number; opening_pic?: number }) =>
    api.put<StockRow>(`${BASE}/stock/${id}`, data),
  getDefaults: () => api.get<{ name: string; rate: number }[]>(`${BASE}/default-products`),
  setDefaults: (rows: { name: string; rate: number }[]) => api.put(`${BASE}/default-products`, rows),
}
