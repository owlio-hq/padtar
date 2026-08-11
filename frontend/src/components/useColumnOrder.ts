import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

type SettingsMap = Record<string, string>

export function useColumnOrder(tableKey: string, defaultOrder: string[]) {
  const settingsKey = `column_order:${tableKey}`
  const qc = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<SettingsMap>('/settings'),
    staleTime: 60_000,
  })

  const [order, setOrderLocal] = useState<string[]>(defaultOrder)

  useEffect(() => {
    if (!settings) return
    const raw = settings[settingsKey]
    if (!raw) { setOrderLocal(defaultOrder); return }
    try {
      const parsed = JSON.parse(raw) as string[]
      if (!Array.isArray(parsed) || parsed.length === 0) { setOrderLocal(defaultOrder); return }
      const valid = parsed.filter((k) => defaultOrder.includes(k))
      const missing = defaultOrder.filter((k) => !parsed.includes(k))
      setOrderLocal([...valid, ...missing])
    } catch {
      setOrderLocal(defaultOrder)
    }
  }, [settings, settingsKey, defaultOrder])

  const saveOrder = useCallback(async (newOrder: string[]) => {
    setOrderLocal(newOrder)
    await api.put(`/settings/${settingsKey}`, { value: JSON.stringify(newOrder) })
    qc.invalidateQueries({ queryKey: ['settings'] })
  }, [settingsKey, qc])

  return { order, saveOrder }
}
