import { useCallback, useEffect, useState } from 'react'
import { Download, WifiOff } from 'lucide-react'
import { api } from '../api/client'
import { saveOpenSheet, sheetHasUnsavedWork } from './openSheet'

/**
 * Update notification (sidebar only).
 *
 * This is a business ledger: an update must never interrupt work or drop a
 * half-entered sheet. So nothing is ever applied automatically — the app checks
 * once a day when it has internet, shows a quiet notice here, and only updates
 * when the worker clicks. Any open sheet is saved first.
 */

const SNOOZE_KEY = 'padtar.update.snoozedUntil'
const SNOOZE_MS = 4 * 60 * 60 * 1000 // remind again later the same day
const POLL_MS = 30 * 60 * 1000 // the backend only calls GitHub once a day anyway

interface UpdateStatus {
  available: boolean
  version: string
  current: string
  offline: boolean
  checked: boolean
}

type Phase = 'idle' | 'saving' | 'updating' | 'restarting'

export function UpdateNotice() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [snoozedUntil, setSnoozedUntil] = useState<number>(() => Number(localStorage.getItem(SNOOZE_KEY) ?? 0))

  const refresh = useCallback(() => {
    api
      .get<UpdateStatus>('/system/update-status')
      .then(setStatus)
      .catch(() => {}) // offline/locked — just try again on the next tick
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  const snoozed = Date.now() < snoozedUntil
  if (!status?.available || (snoozed && !open)) return null

  function snooze() {
    const until = Date.now() + SNOOZE_MS
    localStorage.setItem(SNOOZE_KEY, String(until))
    setSnoozedUntil(until)
    setOpen(false)
  }

  async function updateNow() {
    setError(null)

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
        const poll = () => {
          fetch('/api/health')
            .then((res) => (res.ok ? window.location.reload() : setTimeout(poll, 2000)))
            .catch(() => setTimeout(poll, 2000))
        }
        setTimeout(poll, 3000)
        return
      }
      setPhase('idle')
      setError(
        r.status === 'offline'
          ? 'No internet connection. Connect to the internet and try again — nothing was changed.'
          : r.status === 'locked'
            ? 'This copy is locked. Contact the developer.'
            : r.status === 'dev'
              ? 'Updates only apply in the installed app.'
              : (r.message ?? 'Update failed — the app is unchanged. Try again later.'),
      )
    } catch {
      setPhase('idle')
      setError('No internet connection. Connect to the internet and try again — nothing was changed.')
    }
  }

  const busy = phase !== 'idle'
  const dirty = sheetHasUnsavedWork()

  return (
    <>
      <button className="update-notice" onClick={() => setOpen(true)} title={`Version ${status.version} is available`}>
        <span className="update-dot" />
        <Download size={15} />
        Update available
      </button>

      {open && (
        <div className="dialog-overlay" onClick={() => !busy && setOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
              Update available
            </h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Version <b style={{ color: 'var(--text)' }}>{status.version}</b> is ready to install. You are using
              version {status.current}.
            </p>

            {dirty && phase === 'idle' && (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Your open sheet will be saved before the update starts.
              </p>
            )}
            {phase === 'saving' && (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Saving your sheet…
              </p>
            )}
            {phase === 'updating' && (
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Downloading and installing… please don't close the app.
              </p>
            )}
            {phase === 'restarting' && (
              <p className="mt-2 text-xs" style={{ color: 'var(--tint-total-text)' }}>
                Installed. Restarting the app…
              </p>
            )}
            {error && (
              <p className="mt-3 flex items-start gap-1.5 text-xs" style={{ color: 'var(--tint-negative-text)' }}>
                <WifiOff size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                {error}
              </p>
            )}

            <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Your saved data is never touched by an update.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-outline" onClick={snooze} disabled={busy}>
                Remind me later
              </button>
              <button className="btn btn-primary" onClick={updateNow} disabled={busy}>
                {phase === 'saving'
                  ? 'Saving…'
                  : phase === 'updating'
                    ? 'Updating…'
                    : phase === 'restarting'
                      ? 'Restarting…'
                      : dirty
                        ? 'Save and update'
                        : 'Update now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
