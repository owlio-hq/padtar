import { useState } from 'react'
import { Download, WifiOff } from 'lucide-react'
import { SnoozeMenu } from './SnoozeMenu'
import type { UseUpdateStatus } from './useUpdateStatus'

/**
 * Sidebar "Update available" button + popup. Quiet, but with a dot so it's noticed.
 * All the actual state (polling, snooze, save-then-update) lives in useUpdateStatus,
 * shared with the full Notifications page — this component is just the compact view.
 */
export function UpdateNotice({ u }: { u: UseUpdateStatus }) {
  const [open, setOpen] = useState(false)
  const { status, phase, error, snoozed, dirty, busy, snooze, updateNow } = u

  if (!status?.available || (snoozed && !open)) return null

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
              <SnoozeMenu
                disabled={busy}
                onSnooze={(kind) => {
                  snooze(kind)
                  setOpen(false)
                }}
              />
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
