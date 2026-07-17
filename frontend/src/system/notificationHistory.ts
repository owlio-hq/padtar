/** Local trail of past notifications (updates + bug reports) shown on the
 * Notifications page. Per-machine, kept in localStorage — there is no server
 * for this app to log to, and each install only needs its own trail. */

const HISTORY_KEY = 'padtar.notifications.history'
const MAX_HISTORY = 50

export type HistoryKind =
  | 'update-available'
  | 'update-installed'
  | 'update-snoozed'
  | 'update-error'
  | 'bug-detected'
  | 'bug-submitted'
  | 'bug-failed'

export interface HistoryEntry {
  id: string
  at: number
  kind: HistoryKind
  text: string
}

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function pushHistory(kind: HistoryKind, text: string): void {
  const list = getHistory()
  list.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now(), kind, text })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
}
