import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, RotateCcw, HardDrive, KeyRound, RefreshCw } from 'lucide-react'
import { api, authApi } from '../../api/client'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmDialog } from '../../components/ConfirmDialog'

interface Backup {
  filename: string
  taken_at: string
  size_bytes: number
}

interface SettingsMap {
  [key: string]: string
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const BACKUPS_PER_PAGE = 8

export function SettingsPage() {
  const qc = useQueryClient()
  const [restoreCandidate, setRestoreCandidate] = useState<string | null>(null)
  const [prunePreview, setPrunePreview] = useState<number | null>(null)
  const [backupPage, setBackupPage] = useState(0)

  const backups = useQuery({ queryKey: ['backups'], queryFn: () => api.get<Backup[]>('/backups') })
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<SettingsMap>('/settings') })

  const setSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      api.put(`/settings/${key}`, { value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const backupNow = useMutation({
    mutationFn: () => api.post<Backup>('/backups/now'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  })

  const restore = useMutation({
    mutationFn: (filename: string) => api.post('/backups/restore', { filename }),
    onSuccess: () => {
      qc.invalidateQueries()
    },
  })

  const prune = useMutation({
    mutationFn: (months: number) => api.post<{ deleted: number }>('/backups/prune', { months }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['backups'] })
      alert(`Deleted ${r.deleted} old backup(s).`)
    },
  })

  const s = settings.data ?? {}
  const autoDeleteOn = s['backup.auto_delete_enabled'] === 'true'
  const retention = Number(s['backup.retention_months'] ?? '12') || 12

  const allBackups = backups.data ?? []
  const pageCount = Math.max(1, Math.ceil(allBackups.length / BACKUPS_PER_PAGE))
  const page = Math.min(backupPage, pageCount - 1)
  const pageBackups = allBackups.slice(page * BACKUPS_PER_PAGE, page * BACKUPS_PER_PAGE + BACKUPS_PER_PAGE)

  return (
    <div>
      <PageHeader title="Settings" subtitle="Passwords, backups and preferences" />

      <PasswordSettings />

      <UpdateSettings />

      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <HardDrive size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Backups
          </h3>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Padtar saves a backup copy of your data automatically every time you save an entry.
          Use “Back up now” for an extra copy, or “Restore” to go back to an older copy of your data.
        </p>
        <div className="mb-4 flex gap-2">
          <button
            className="btn btn-primary"
            onClick={() => backupNow.mutate()}
            disabled={backupNow.isPending}
          >
            <Database size={14} />
            Back up now
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Recent backups
          </span>
          {allBackups.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {allBackups.length} total
            </span>
          )}
        </div>
        <div className="card overflow-hidden" style={{ minHeight: 340 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Taken at</th>
                <th style={{ textAlign: 'right' }}>Size</th>
                <th style={{ width: 60, textAlign: 'right' }} />
              </tr>
            </thead>
            <tbody>
              {backups.isLoading && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!backups.isLoading && allBackups.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                    No backups yet.
                  </td>
                </tr>
              )}
              {pageBackups.map((b) => (
                <tr key={b.filename}>
                  <td style={{ fontWeight: 500 }}>{fmtTs(b.taken_at)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtBytes(b.size_bytes)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setRestoreCandidate(b.filename)}
                      title="Replace current data with this backup"
                    >
                      <RotateCcw size={13} />
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {allBackups.length > BACKUPS_PER_PAGE && (
          <div className="mt-3 flex items-center justify-between">
            <button className="btn btn-outline btn-sm" disabled={page === 0} onClick={() => setBackupPage(page - 1)}>
              ‹ Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Page {page + 1} of {pageCount}
            </span>
            <button className="btn btn-outline btn-sm" disabled={page >= pageCount - 1} onClick={() => setBackupPage(page + 1)}>
              Next ›
            </button>
          </div>
        )}
      </div>

      <div className="card mb-4 p-5">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Auto-delete old backups
          </h3>
        </div>
        <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          Normally every backup is kept forever. Turn this on only if you want the app to clean up
          backups older than the time you choose here.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoDeleteOn}
              onChange={(e) =>
                setSetting.mutate({ key: 'backup.auto_delete_enabled', value: e.target.checked ? 'true' : 'false' })
              }
            />
            <span>Enable auto-delete</span>
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ opacity: autoDeleteOn ? 1 : 0.5 }}>
            <span>Keep last</span>
            <select
              className="field w-auto"
              disabled={!autoDeleteOn}
              value={String(retention)}
              onChange={(e) =>
                setSetting.mutate({ key: 'backup.retention_months', value: e.target.value })
              }
            >
              {[3, 6, 9, 12, 18, 24, 36].map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-outline"
            disabled={!autoDeleteOn}
            onClick={() => setPrunePreview(retention)}
            title="Delete now everything older than the retention period"
          >
            Delete old now
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={restoreCandidate !== null}
        title="Restore this backup?"
        message={
          restoreCandidate
            ? `This will replace your current data with the snapshot from ${fmtTs(
                (backups.data ?? []).find((b) => b.filename === restoreCandidate)?.taken_at ?? '',
              )}. A safety backup of your current data will be taken first, so you can undo this.`
            : ''
        }
        confirmLabel="Restore"
        onConfirm={() => {
          if (restoreCandidate) restore.mutate(restoreCandidate)
          setRestoreCandidate(null)
        }}
        onCancel={() => setRestoreCandidate(null)}
      />

      <ConfirmDialog
        open={prunePreview !== null}
        title="Delete old backups?"
        message={
          prunePreview !== null
            ? `All backups older than ${prunePreview} months will be permanently deleted. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (prunePreview !== null) prune.mutate(prunePreview)
          setPrunePreview(null)
        }}
        onCancel={() => setPrunePreview(null)}
      />
    </div>
  )
}

function PasswordChanger({ which, label, hint }: { which: 'login' | 'edit'; label: string; hint: string }) {
  const [currentEdit, setCurrentEdit] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const change = useMutation({
    mutationFn: () => authApi.changePassword(which, currentEdit, newPassword),
    onSuccess: () => {
      setMsg({ ok: true, text: 'Password changed.' })
      setCurrentEdit('')
      setNewPassword('')
    },
    onError: () => setMsg({ ok: false, text: 'Wrong admin password — nothing changed.' }),
  })

  return (
    <div className="setting-block">
      <h4 className="text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{label}</h4>
      <p className="mb-3 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      <div className="grid gap-2">
        <input
          type="password"
          className="field"
          value={currentEdit}
          onChange={(e) => setCurrentEdit(e.target.value)}
          placeholder="Admin (edit) password"
        />
        <input
          type="password"
          className="field"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={`New ${which} password`}
        />
        <button
          className="btn btn-primary"
          disabled={change.isPending || !currentEdit || !newPassword}
          onClick={() => {
            setMsg(null)
            change.mutate()
          }}
        >
          Change {which} password
        </button>
      </div>
      {msg && (
        <p className="mt-2 text-xs" style={{ color: msg.ok ? 'var(--tint-padtar-text)' : 'var(--tint-negative-text)' }}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

function PasswordSettings() {
  return (
    <div className="card mb-4 p-5">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound size={16} style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Admin — passwords
        </h3>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        Changing any password here needs the current admin (edit) password.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <PasswordChanger
          which="login"
          label="Login password"
          hint="Asked every time the app is opened. Everyone who uses the app enters this."
        />
        <PasswordChanger
          which="edit"
          label="Edit (admin) password"
          hint="Asked before changing any rate, unit or item, and before deleting anything. Keep this one private."
        />
      </div>
    </div>
  )
}

function UpdateSettings() {
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.get<{ version: string }>('/system/status').then((s) => setVersion(s.version)).catch(() => {})
  }, [])

  async function checkUpdate() {
    setBusy(true)
    setStatus(null)
    try {
      // Checking never installs anything — if an update exists, the notice in the
      // sidebar is where they choose to install it (so open work is saved first).
      const r = await api.post<{ status: string; version?: string }>('/system/check-update')
      setStatus(
        r.status === 'available'
          ? `Version ${r.version} is available — use the “Update available” button in the sidebar to install it.`
          : r.status === 'up_to_date'
            ? `You have the latest version (v${r.version ?? version}).`
            : r.status === 'offline'
              ? 'No internet — could not check for updates.'
              : r.status === 'dev'
                ? 'Updates only apply in the installed app.'
                : 'Access check failed.',
      )
    } catch {
      setStatus('Could not check — try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mb-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <RefreshCw size={16} style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          App & updates
        </h3>
      </div>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Checks the internet for a newer version of Padtar and installs it. Your entries, backups
        and passwords are not touched by an update.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Current version: <b style={{ color: 'var(--text)' }}>v{version || '…'}</b>
        </span>
        <button className="btn btn-outline" onClick={checkUpdate} disabled={busy}>
          <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} />
          {busy ? 'Checking…' : 'Check for update'}
        </button>
      </div>
      {status && (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {status}
        </p>
      )}
    </div>
  )
}
