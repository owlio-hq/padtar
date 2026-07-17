import { api } from '../api/client'
import { pushHistory } from './notificationHistory'

/**
 * Client-facing bug reporting. A crash never sends itself — it lands in a
 * local "pending" queue, shows up on the Notifications page, and only goes
 * to GitHub once the client clicks Submit there.
 */

const PENDING_KEY = 'padtar.bugreports.pending'
const SEEN_KEY = 'padtar.bugreports.seenThisSession'
const MAX_PENDING = 20

export interface PendingReport {
  id: string
  detectedAt: number
  message: string
  detail: string
  auto: boolean
}

function readPending(): PendingReport[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writePending(list: PendingReport[]): void {
  localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(0, MAX_PENDING)))
}

export function getPending(): PendingReport[] {
  return readPending()
}

export function dismissPending(id: string): void {
  writePending(readPending().filter((p) => p.id !== id))
}

function hashKey(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h)
}

/** Queue a crash for the client to review — deduped per session so a repeating
 * error doesn't flood the notifications list. */
export function queueAutoReport(message: string, detail: string): void {
  const key = hashKey(message)
  let seen: string[] = []
  try {
    seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]')
  } catch {
    seen = []
  }
  if (seen.includes(key)) return
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, key].slice(-30)))

  const entry: PendingReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    detectedAt: Date.now(),
    message,
    detail,
    auto: true,
  }
  writePending([entry, ...readPending()])
  pushHistory('bug-detected', `A problem was detected: ${message}`)
}

/** Catches crashes the app itself can't recover from. Call once at startup. */
export function installCrashReporter(): void {
  window.addEventListener('error', (e) => {
    queueAutoReport(e.message || 'Unknown error', `${e.filename ?? ''}:${e.lineno ?? ''}\n${e.error?.stack ?? ''}`.trim())
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string; stack?: string } | undefined
    queueAutoReport(reason?.message || String(reason), reason?.stack || '')
  })
}

export interface SubmitResult {
  ok: boolean
  message: string
}

export async function submitReport(description: string, auto: boolean): Promise<SubmitResult> {
  try {
    const r = await api.post<{ status: string; message?: string }>('/system/report-bug', {
      description,
      context: {
        url: window.location.pathname,
        timestamp: new Date().toISOString(),
        auto,
      },
    })
    if (r.status === 'sent') {
      pushHistory('bug-submitted', 'Problem report sent.')
      return { ok: true, message: 'Sent — thank you.' }
    }
    if (r.status === 'offline') {
      pushHistory('bug-failed', 'Could not send report — no internet.')
      return { ok: false, message: 'No internet connection. It has not been sent — try again once you are back online.' }
    }
    if (r.status === 'not_configured') {
      return { ok: false, message: 'Reporting is not turned on for this copy yet — please tell the developer directly for now.' }
    }
    if (r.status === 'locked') {
      return { ok: false, message: 'This copy is locked. Contact the developer.' }
    }
    pushHistory('bug-failed', r.message || 'Could not send report.')
    return { ok: false, message: r.message || 'Could not send the report. Try again later.' }
  } catch {
    pushHistory('bug-failed', 'Could not send report — no internet.')
    return { ok: false, message: 'No internet connection. It has not been sent — try again once you are back online.' }
  }
}
