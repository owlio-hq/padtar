import { useState } from 'react'
import { AlertTriangle, Bell, Download, Send, Trash2, WifiOff } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { useUpdateStatus } from '../../system/useUpdateStatus'
import { SnoozeMenu } from '../../system/SnoozeMenu'
import { getHistory, type HistoryEntry } from '../../system/notificationHistory'
import { getPending, dismissPending, submitReport, type PendingReport } from '../../system/bugReports'

function fmtWhen(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const HISTORY_ICON: Record<HistoryEntry['kind'], typeof Bell> = {
  'update-available': Download,
  'update-installed': Download,
  'update-snoozed': Bell,
  'update-error': WifiOff,
  'bug-detected': AlertTriangle,
  'bug-submitted': Send,
  'bug-failed': WifiOff,
}

export function NotificationsPage() {
  const u = useUpdateStatus()
  const [pending, setPending] = useState<PendingReport[]>(() => getPending())
  const [history] = useState(() => getHistory())
  const [manualText, setManualText] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null)

  const available = !!u.status?.available

  async function submit(id: string | null, text: string, auto: boolean) {
    setBusyId(id ?? 'manual')
    setMsg(null)
    const r = await submitReport(text, auto)
    setMsg(r)
    if (r.ok) {
      if (id) {
        dismissPending(id)
        setPending(getPending())
      } else {
        setManualText('')
      }
    }
    setBusyId(null)
  }

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Updates and problem reports for Padtar" />

      {available && (
        <div className="card mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Download size={16} style={{ color: 'var(--accent)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Update available
            </h3>
          </div>
          <p className="mb-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Version <b style={{ color: 'var(--text)' }}>{u.status?.version}</b> is ready to install. You are using
            version {u.status?.current}.
          </p>

          {u.dirty && u.phase === 'idle' && (
            <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
              Your open sheet will be saved before the update starts.
            </p>
          )}
          {u.phase === 'saving' && (
            <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Saving your sheet…
            </p>
          )}
          {u.phase === 'updating' && (
            <p className="mb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Downloading and installing… please don't close the app.
            </p>
          )}
          {u.phase === 'restarting' && (
            <p className="mb-3 text-xs" style={{ color: 'var(--tint-total-text)' }}>
              Installed. Restarting the app…
            </p>
          )}
          {u.error && (
            <p className="mb-3 flex items-start gap-1.5 text-xs" style={{ color: 'var(--tint-negative-text)' }}>
              <WifiOff size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              {u.error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-primary" onClick={u.updateNow} disabled={u.busy}>
              <Download size={14} />
              {u.phase === 'saving'
                ? 'Saving…'
                : u.phase === 'updating'
                  ? 'Updating…'
                  : u.phase === 'restarting'
                    ? 'Restarting…'
                    : u.dirty
                      ? 'Save and update'
                      : 'Update now'}
            </button>
            <SnoozeMenu disabled={u.busy} onSnooze={u.snooze} />
          </div>

          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Updates never apply automatically and your saved data is never touched.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={16} style={{ color: 'var(--tint-negative-text)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              A problem was noticed
            </h3>
          </div>
          <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            Padtar noticed something didn't work right. Nothing is sent unless you click Submit below.
          </p>
          <div className="grid gap-3">
            {pending.map((p) => (
              <div key={p.id} className="setting-block">
                <p className="text-sm" style={{ color: 'var(--text)' }}>
                  {p.message}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {fmtWhen(p.detectedAt)}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => submit(p.id, `${p.message}\n\n${p.detail}`, true)}
                  >
                    <Send size={13} />
                    {busyId === p.id ? 'Sending…' : 'Submit report'}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busyId === p.id}
                    onClick={() => {
                      dismissPending(p.id)
                      setPending(getPending())
                    }}
                  >
                    <Trash2 size={13} />
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Send size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Report a problem
          </h3>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Noticed something wrong that Padtar didn't catch on its own? Describe it here and it goes straight to the
          developer.
        </p>
        <textarea
          className="field"
          rows={3}
          placeholder="What happened, and what were you doing at the time?"
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <div className="mt-3">
          <button
            className="btn btn-primary"
            disabled={!manualText.trim() || busyId === 'manual'}
            onClick={() => submit(null, manualText.trim(), false)}
          >
            <Send size={14} />
            {busyId === 'manual' ? 'Sending…' : 'Submit'}
          </button>
        </div>
        {msg && (
          <p
            className="mt-3 flex items-start gap-1.5 text-xs"
            style={{ color: msg.ok ? 'var(--tint-padtar-text)' : 'var(--tint-negative-text)' }}
          >
            {!msg.ok && <WifiOff size={13} style={{ marginTop: 1, flexShrink: 0 }} />}
            {msg.message}
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            History
          </h3>
        </div>
        {history.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Nothing yet — updates and problem reports will show up here.
          </p>
        ) : (
          <div className="grid gap-2.5">
            {history.map((h) => {
              const Icon = HISTORY_ICON[h.kind] ?? Bell
              return (
                <div key={h.id} className="flex items-start gap-2.5">
                  <Icon size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--text-muted)' }} />
                  <div>
                    <p className="text-sm" style={{ color: 'var(--text)' }}>
                      {h.text}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {fmtWhen(h.at)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
