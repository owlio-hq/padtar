import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setOpenSheet } from '../system/openSheet'

/**
 * Stops a half-entered sheet from being lost.
 *
 * If the worker leaves a batch/day with unsaved edits — back arrow, sidebar,
 * closing the tab — they're asked to save first. Also registers the sheet so an
 * app update can save it before restarting.
 *
 * `payload` is the serialised form state; it's compared against the last saved
 * snapshot to decide "dirty", so no manual change-tracking is needed.
 */
export function useUnsavedGuard({
  payload,
  save,
  ready,
}: {
  payload: string
  save: () => Promise<void>
  /** Only start guarding once the sheet has finished loading/seeding. */
  ready: boolean
}) {
  const navigate = useNavigate()
  const baseline = useRef<string | null>(null)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // First time the sheet is ready, remember it as "clean".
  useEffect(() => {
    if (ready && baseline.current === null) baseline.current = payload
  }, [ready, payload])

  const isDirty = ready && baseline.current !== null && baseline.current !== payload

  // Keep the latest values reachable from the (stable) listeners below.
  const live = useRef({ isDirty, save })
  live.current = { isDirty, save }

  /** Call after a successful save so the sheet counts as clean again. */
  function markSaved(saved: string = payload) {
    baseline.current = saved
  }

  // Expose to the updater: it must save this sheet before restarting.
  useEffect(() => {
    setOpenSheet({
      dirty: () => live.current.isDirty,
      save: () => live.current.save(),
    })
    return () => setOpenSheet(null)
  }, [])

  // Browser close / refresh — native "leave site?" prompt.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!live.current.isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // In-app navigation (back arrow, sidebar): intercept the link and ask first.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!live.current.isDirty) return
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      // let downloads (Excel/PDF export) and external links through untouched
      if (!href || !href.startsWith('/') || href.startsWith('/api/') || anchor.target === '_blank') return

      e.preventDefault()
      e.stopPropagation()
      setError(null)
      setPendingHref(href)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  function leave(href: string) {
    baseline.current = null // stop guarding; we're leaving on purpose
    setPendingHref(null)
    navigate(href)
  }

  async function saveThenLeave() {
    if (!pendingHref) return
    setSaving(true)
    setError(null)
    try {
      await live.current.save()
      leave(pendingHref)
    } catch {
      setError('Could not save — please check the sheet and try again.')
    } finally {
      setSaving(false)
    }
  }

  const dialog = pendingHref && (
    <div className="dialog-overlay" onClick={() => setPendingHref(null)}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
          Save your changes?
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          You have changes that are not saved yet. If you leave now they will be lost.
        </p>
        {error && (
          <p className="mt-2 text-xs" style={{ color: 'var(--tint-negative-text)' }}>
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={() => setPendingHref(null)} disabled={saving}>
            Stay here
          </button>
          <button className="btn btn-danger" onClick={() => leave(pendingHref)} disabled={saving}>
            Leave without saving
          </button>
          <button className="btn btn-primary" onClick={saveThenLeave} disabled={saving}>
            {saving ? 'Saving…' : 'Save and leave'}
          </button>
        </div>
      </div>
    </div>
  )

  return { isDirty, markSaved, dialog }
}
