import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

type Language = 'gujarati' | 'english'

export interface Label {
  key: string
  gujarati_label: string
  english_label: string
}

const STORAGE_KEY = 'padtar.language'

const LabelsContext = createContext<{
  language: Language
  toggle: () => void
  t: (key: string, fallback?: string) => string
} | null>(null)

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'english' ? 'english' : 'gujarati'
}

export function LabelsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage)
  const { data: labels } = useQuery({
    queryKey: ['labels'],
    queryFn: () => api.get<Label[]>('/labels'),
    staleTime: Infinity,
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
  }, [language])

  const toggle = () => setLanguage((l) => (l === 'gujarati' ? 'english' : 'gujarati'))

  const t = (key: string, fallback?: string): string => {
    const label = labels?.find((l) => l.key === key)
    if (!label) return fallback ?? key
    return language === 'gujarati' ? label.gujarati_label : label.english_label
  }

  return <LabelsContext.Provider value={{ language, toggle, t }}>{children}</LabelsContext.Provider>
}

export function useLabels() {
  const ctx = useContext(LabelsContext)
  if (!ctx) throw new Error('useLabels must be used within LabelsProvider')
  return ctx
}
