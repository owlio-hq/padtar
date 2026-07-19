import { useEffect, useRef } from 'react'

/**
 * Ctrl/Cmd+S saves the current entry instead of opening the browser's
 * "save this web page" dialog. Used by both the Rojmel day and Shakkarpara
 * batch forms so the worker's muscle memory just works.
 *
 * `enabled` lets the caller ignore the shortcut while a save is already in
 * flight (avoids double-submit).
 */
export function useSaveShortcut(onSave: () => void, enabled = true) {
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault() // stop the browser save-page dialog
        if (enabledRef.current) saveRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
