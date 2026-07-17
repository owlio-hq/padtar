import { createContext, useContext, type ReactNode } from 'react'
import { useUpdateStatus, type UseUpdateStatus } from './useUpdateStatus'

/**
 * ONE update-status instance for the whole app.
 *
 * The sidebar button, the toast and the Notifications page must agree about
 * what's available and what's been snoozed. Calling useUpdateStatus() in each
 * of them does NOT do that: each call gets its own React state, and snooze
 * state is only read from localStorage at init — so snoozing on the page left
 * the sidebar still advertising the update until a reload. Hence one instance,
 * shared here.
 */
const UpdateContext = createContext<UseUpdateStatus | null>(null)

export function UpdateProvider({ children }: { children: ReactNode }) {
  const update = useUpdateStatus()
  return <UpdateContext.Provider value={update}>{children}</UpdateContext.Provider>
}

export function useUpdate(): UseUpdateStatus {
  const ctx = useContext(UpdateContext)
  if (!ctx) throw new Error('useUpdate must be used inside <UpdateProvider>')
  return ctx
}
