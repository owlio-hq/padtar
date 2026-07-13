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
          Snapshots are taken automatically every time you save. They're stored locally on this
          computer only. Backups are <b>never deleted</b> unless you turn on auto-delete below.
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
          When on, backups older than the chosen period are deleted. When off (default), nothing
          is ever deleted.
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

function PasswordSettings() {
  const [which, setWhich] = useState<'login' | 'edit'>('login')
  const [currentEdit, setCurrentEdit] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const change = useMutation({
    mutationFn: () => authApi.changePassword(which, currentEdit, newPassword),
    onSuccess: () => {
      setMsg({ ok: true, text: `${which === 'login' ? 'Login' : 'Edit'} password changed.` })
      setCurrentEdit('')
      setNewPassword('')
    },
    onError: () => setMsg({ ok: false, text: 'Wrong edit password — nothing changed.' }),
  })

  return (
    <div className="card mb-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound size={16} style={{ color: 'var(--text-muted)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          Passwords
        </h3>
      </div>
      <p className="mb-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        The <b>login</b> password opens the app. The <b>edit</b> password is needed to change rates,
        units, ingredients, or to delete. Changing either requires the current edit password.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">Change which</label>
          <select className="field w-auto" value={which} onChange={(e) => setWhich(e.target.value as 'login' | 'edit')}>
            <option value="login">Login password</option>
            <option value="edit">Edit password</option>
          </select>
        </div>
        <div>
          <label className="field-label">Current edit password</label>
          <input
            type="password"
            className="field"
            value={currentEdit}
            onChange={(e) => setCurrentEdit(e.target.value)}
            placeholder="Required"
          />
        </div>
        <div>
          <label className="field-label">New {which} password</label>
          <input type="password" className="field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <button
          className="btn btn-primary"
          disabled={change.isPending || !currentEdit || !newPassword}
          onClick={() => {
            setMsg(null)
            change.mutate()
          }}
        >
          Change password
        </button>
      </div>
      {msg && (
        <p className="mt-3 text-xs" style={{ color: msg.ok ? 'var(--tint-padtar-text)' : 'var(--tint-negative-text)' }}>
          {msg.text}
        </p>
      )}
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
      const r = await api.post<{ status: string; version?: string }>('/system/check-update')
      if (r.status === 'updated') {
        setStatus('Update installed — restarting the app…')
        // wait for the server to come back on the new code, then reload
        const poll = () => {
          fetch('/api/health')
            .then((res) => (res.ok ? window.location.reload() : setTimeout(poll, 2000)))
            .catch(() => setTimeout(poll, 2000))
        }
        setTimeout(poll, 3000)
        return
      }
      setStatus(
        r.status === 'up_to_date'
          ? `You have the latest version (v${r.version ?? version}).`
          : r.status === 'offline'
            ? 'No internet — could not check for updates.'
            : r.status === 'dev'
              ? 'Updates only apply in the installed app.'
              : r.status === 'error'
                ? 'Update failed — nothing was changed. Try again later.'
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
