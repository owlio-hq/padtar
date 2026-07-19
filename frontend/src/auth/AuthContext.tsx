import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { authApi } from '../api/client'

/**
 * Unlock scopes are kept separate on purpose. Unlocking the stock columns
 * (opening counts, which get typed often) must NOT also loosen rate/structural
 * edits — those stay individually gated. So each scope has its own timer.
 */
export type EditScope = 'default' | 'stock'

interface AuthContextValue {
  loggedIn: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
  /**
   * Ask for the edit password (unless the given scope is already unlocked for a
   * short window). Resolves true if the correct password was entered, false if
   * the user cancelled or it was wrong. Restricted actions call this first.
   */
  requireEdit: (scope?: EditScope) => Promise<boolean>
  /** Immediately end edit access for a scope, so the next action re-prompts. */
  lockEdit: (scope?: EditScope) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LOGIN_KEY = 'padtar.loggedIn'
// Once the edit password is verified, keep that scope unlocked for this long so
// the worker isn't re-prompted for every single field in one editing session.
const UNLOCK_MS: Record<EditScope, number> = {
  default: 3 * 60 * 1000,
  stock: 5 * 60 * 1000, // opening counts are entered across many products at once
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(LOGIN_KEY) === '1')
  const unlockedUntil = useRef<Record<EditScope, number>>({ default: 0, stock: 0 })
  const pendingScope = useRef<EditScope>('default')

  // The edit-password modal is driven by a pending promise resolver.
  const [askOpen, setAskOpen] = useState(false)
  const [askError, setAskError] = useState(false)
  const [busy, setBusy] = useState(false)
  const resolverRef = useRef<((ok: boolean) => void) | null>(null)

  const login = useCallback(async (password: string) => {
    const { ok } = await authApi.login(password)
    if (ok) {
      setLoggedIn(true)
      sessionStorage.setItem(LOGIN_KEY, '1')
    }
    return ok
  }, [])

  const logout = useCallback(() => {
    setLoggedIn(false)
    unlockedUntil.current = { default: 0, stock: 0 }
    sessionStorage.removeItem(LOGIN_KEY)
  }, [])

  const requireEdit = useCallback((scope: EditScope = 'default') => {
    if (Date.now() < unlockedUntil.current[scope]) return Promise.resolve(true)
    pendingScope.current = scope
    setAskError(false)
    setAskOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const submitEdit = useCallback(async (password: string) => {
    setBusy(true)
    try {
      const { ok } = await authApi.verifyEdit(password)
      if (ok) {
        const scope = pendingScope.current
        unlockedUntil.current[scope] = Date.now() + UNLOCK_MS[scope]
        setAskOpen(false)
        resolverRef.current?.(true)
        resolverRef.current = null
      } else {
        setAskError(true)
      }
    } finally {
      setBusy(false)
    }
  }, [])

  const cancelEdit = useCallback(() => {
    setAskOpen(false)
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  const lockEdit = useCallback((scope: EditScope = 'default') => {
    unlockedUntil.current[scope] = 0
  }, [])

  return (
    <AuthContext.Provider value={{ loggedIn, login, logout, requireEdit, lockEdit }}>
      {children}
      {askOpen && (
        <EditPasswordModal error={askError} busy={busy} onSubmit={submitEdit} onCancel={cancelEdit} />
      )}
    </AuthContext.Provider>
  )
}

function EditPasswordModal({
  error,
  busy,
  onSubmit,
  onCancel,
}: {
  error: boolean
  busy: boolean
  onSubmit: (pw: string) => void
  onCancel: () => void
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
          Edit password needed
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Enter the edit password to change rates, units, ingredients, or to delete.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(pw)
          }}
        >
          <input
            autoFocus
            type="password"
            className="field mt-3"
            placeholder="Edit password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          {error && (
            <p className="mt-2 text-xs" style={{ color: 'var(--tint-negative-text)' }}>
              Wrong password. Try again.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !pw}>
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
