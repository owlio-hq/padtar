import { api } from '../../api/client'
import type { Batch, BatchInput, HistorySnapshot } from './types'

const BASE = '/shakkarpara'

export const shakkarparaApi = {
  list: (params?: { year?: number; month?: number }) => {
    const qs = new URLSearchParams()
    if (params?.year) qs.set('year', String(params.year))
    if (params?.month) qs.set('month', String(params.month))
    const suffix = qs.toString() ? `?${qs}` : ''
    return api.get<Batch[]>(`${BASE}/batches${suffix}`)
  },
  get: (id: number) => api.get<Batch>(`${BASE}/batches/${id}`),
  create: (data: BatchInput) => api.post<Batch>(`${BASE}/batches`, data),
  update: (id: number, data: BatchInput) => api.put<Batch>(`${BASE}/batches/${id}`, data),
  remove: (id: number) => api.delete(`${BASE}/batches/${id}`),
  history: (id: number) => api.get<HistorySnapshot[]>(`${BASE}/batches/${id}/history`),
  undo: (id: number) => api.post<Batch>(`${BASE}/batches/${id}/undo`),
  getDefaults: () => api.get<Omit<import('./types').Ingredient, 'id' | 'total'>[]>(`${BASE}/default-ingredients`),
  setDefaults: (rows: Omit<import('./types').Ingredient, 'id' | 'total'>[]) =>
    api.put(`${BASE}/default-ingredients`, rows),
}
