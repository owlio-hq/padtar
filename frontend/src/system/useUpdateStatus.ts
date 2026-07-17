import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { saveOpenSheet, sheetHasUnsavedWork } from './openSheet'
import { pushHistory } from './notificationHistory'

/**
 * Shared update-check state (sidebar button, the toast, and the full
 * Notifications page all use this, so there is one source of truth for "is an
 * update available / mid-flight").
 *
 * Nothing here ever applies automatically — the app checks GitHub once a day when
 * online, and only updates on an explicit click, saving any open sheet first.
 */

const SNOOZE_KEY = 'padtar.update.snoozedUntil'
const ANNOUNCED_KEY = 'padtar.update.announcedVersion' // last version we logged to history, so it's only logged once
const POLL_MS = 30 * 60 * 1000 // the backend only calls GitHub once a day anyway

export type SnoozeKind = 'later' | 'evening' | 'tomorrow'

function computeSnoozeUntil(kind: SnoozeKind): number {
  const now = new Date()
  if (kind === 'later') return now.getTime() + 4 * 60 * 60 * 1000
  if (kind === 'evening') {
    const evening = new Date(now)
    evening.setHours(18, 0, 0, 0)
    if (evening.getTime() <= now.getTime()) evening.setDate(evening.getDate() + 1)
    return evening.getTime()
  }
  // tomorrow morning
  const morning = new Date(now)
  morning.setDate(morning.getDate() + 1)
  morning.setHours(9, 0, 0, 0)
  return morning.getTime()
}

const SNOOZE_LABEL: Record<SnoozeKind, string> = {
  later: 'in 4 hours',
  evening: 'this evening',
  tomorrow: 'tomorrow morning',
}

export interface UpdateStatus {
  available: boolean
  version: string
  current: string
  offline: boolean
  checked: boolean
}

export type UpdatePhase = 'idle' | 'saving' | 'updating' | 'restarting'

export function useUpdateStatus() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<number | null>(null)
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => Number(localStorage.getItem(SNOOZE_KEY) ?? 0))

  const refresh = useCallback(() => {
    api
      .get<UpdateStatus>('/system/update-status')
      .then((r) => {
        setStatus(r)
        setLastChecked(Date.now())
        if (r.available && localStorage.getItem(ANNOUNCED_KEY) !== r.version) {
          localStorage.setItem(ANNOUNCED_KEY, r.version)
          pushHistory('update-available', `Version ${r.version} is available (you have ${r.current}).`)
        }
      })
      .catch(() => {}) // offline/locked — just try again on the next tick
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  function snooze(kind: SnoozeKind = 'later') {
    const until = computeSnoozeUntil(kind)
    localStorage.setItem(SNOOZE_KEY, String(until))
    setSnoozedUntil(until)
    pushHistory('update-snoozed', `Update reminder snoozed — ${SNOOZE_LABEL[kind]}.`)
  }

  async function updateNow() {
    setError(null)
    const versionBeingApplied = status?.version

    // 1. never lose in-progress work
    if (sheetHasUnsavedWork()) {
      setPhase('saving')
      try {
        await saveOpenSheet()
      } catch {
        setPhase('idle')
        setError('Could not save your open sheet, so the update was cancelled. Please save it yourself, then try again.')
        return
      }
    }

    // 2. apply
    setPhase('updating')
    try {
      const r = await api.post<{ status: string; version?: string; message?: string }>('/system/apply-update')
      if (r.status === 'updated') {
        setPhase('restarting')
        pushHistory('update-installed', `Updated to version ${r.version ?? versionBeingApplied ?? ''}.`)
        const poll = () => {
          fetch('/api/health')
            .then((res) => (res.ok ? window.location.reload() : setTimeout(poll, 2000)))
            .catch(() => setTimeout(poll, 2000))
        }
        setTimeout(poll, 3000)
        return
      }
      setPhase('idle')
      const msg =
        r.status === 'offline'
          ? 'No internet connection. Connect to the internet and try again — nothing was changed.'
          : r.status === 'locked'
            ? 'This copy is locked. Contact the developer.'
            : r.status === 'dev'
              ? 'Updates only apply in the installed app.'
              : (r.message ?? 'Update failed — the app is unchanged. Try again later.')
      setError(msg)
      if (r.status !== 'offline') pushHistory('update-error', msg)
    } catch {
      setPhase('idle')
      setError('No internet connection. Connect to the internet and try again — nothing was changed.')
    }
  }

  const snoozed = Date.now() < snoozedUntil

  return {
    status,
    phase,
    error,
    lastChecked,
    snoozed,
    dirty: sheetHasUnsavedWork(),
    busy: phase !== 'idle',
    refresh,
    snooze,
    updateNow,
  }
}

export type UseUpdateStatus = ReturnType<typeof useUpdateStatus>
