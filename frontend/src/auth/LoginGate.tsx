import { useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

/**
 * Wraps the whole app. Until the worker enters the login password, they see
 * only this screen. Session-scoped — closing the browser logs out.
 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { loggedIn, login } = useAuth()
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loggedIn) return <>{children}</>

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(false)
    try {
      const ok = await login(pw)
      if (!ok) setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: 'var(--surface-alt)' }}
    >
      <div className="card w-full max-w-sm p-7">
        <div className="mb-1 flex items-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded font-semibold"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            P
          </div>
          <div>
            <div className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              Padtar
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Factory Ledger
            </div>
          </div>
        </div>

        <p className="mb-4 mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Enter your password to open the app.
        </p>

        <form onSubmit={submit}>
          <input
            autoFocus
            type="password"
            className="field"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--tint-negative-text)' }}>
              Wrong password. Try again.
            </p>
          )}
          <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || !pw}>
            {busy ? 'Checking…' : 'Open Padtar'}
          </button>
        </form>
      </div>
    </div>
  )
}
