import { useEffect, useState, type ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { api } from '../api/client'

interface SystemStatus {
  locked: boolean
  reason: string
  version: string
}

let notifyLocked: (() => void) | null = null

/** Called by the api client when any request returns 423 (locked mid-session). */
export function reportLocked() {
  notifyLocked?.()
}

/**
 * Outermost gate: asks the backend for the remote-access status before the
 * login screen ever shows. When locked (remote flag false, or trial date
 * passed while offline) the whole app is replaced with the lock message.
 */
export function GuardGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null)

  useEffect(() => {
    notifyLocked = () => setLocked(true)
    api
      .get<SystemStatus>('/system/status')
      .then((s) => setLocked(s.locked))
      .catch(() => setLocked(false)) // backend unreachable → let the app try normally
    return () => {
      notifyLocked = null
    }
  }, [])

  if (locked === null) return null // brief blank while status loads

  if (locked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ backgroundColor: 'var(--surface-alt)' }}
      >
        <div className="card w-full max-w-md p-8 text-center">
          <ShieldAlert size={40} style={{ color: 'var(--tint-negative-text)', margin: '0 auto 14px' }} />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
            Trial ended
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Contact the developer for support.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
