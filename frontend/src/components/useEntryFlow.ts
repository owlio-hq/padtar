import { useCallback, useRef } from 'react'

/**
 * Enter moves the cursor to the next day-to-day entry box.
 *
 * The worker fills a whole column top-to-bottom (Vaprash in Shakkarpara, Pic in
 * Rojmel) — pressing Enter should land them on the next one, continuing across
 * category tables, instead of doing nothing. Rate/unit are edited via the pencil
 * dialog, so they are deliberately not part of this flow.
 *
 * Boxes opt in with `entryFlow` on NumberField (renders `data-entry-flow`);
 * read-only cells like the auto Oil Vaprayel usage are skipped for free.
 *
 * The attribute's VALUE is a group: Enter only moves within the same group, so a
 * column like Opening flows straight down to the next Opening instead of hopping
 * sideways into Closing. The default (unnamed) group is the empty string.
 *
 * Arrow keys navigate a 2D grid of inputs across rows and columns, skipping
 * non-input cells. Inputs opt in with `data-grid-row` and `data-grid-col`
 * attributes. If a target cell has `data-grid-locked`, the `onLockedCell`
 * callback fires so the page can prompt for a password.
 */
export function useEntryFlow<T extends HTMLElement>(onLockedCell?: () => void) {
  const containerRef = useRef<T>(null)
  const lockedRef = useRef(onLockedCell)
  lockedRef.current = onLockedCell

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement

    // --- Enter: walk down within the same entry-flow group ---
    if (e.key === 'Enter') {
      if (!target.matches?.('[data-entry-flow]')) return
      e.preventDefault()

      const group = target.getAttribute('data-entry-flow')
      const boxes = Array.from(
        containerRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-entry-flow]') ?? [],
      ).filter((el) => !el.disabled && el.offsetParent !== null && el.getAttribute('data-entry-flow') === group)

      const next = boxes[boxes.indexOf(target as HTMLInputElement | HTMLTextAreaElement) + 1]
      if (next) {
        next.focus()
        next.select()
      } else {
        target.blur()
      }
      return
    }

    // --- Arrow keys: 2D grid navigation ---
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
    if (!target.matches?.('[data-grid-row]')) return

    // For text inputs, let Left/Right move the text cursor normally.
    // Only intercept Up/Down (row navigation) and Left/Right on number inputs.
    const isTextInput = target instanceof HTMLInputElement && target.type !== 'number'
    if (isTextInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return

    e.preventDefault()

    const row = Number(target.getAttribute('data-grid-row'))
    const col = Number(target.getAttribute('data-grid-col'))
    if (Number.isNaN(row) || Number.isNaN(col)) return

    const container = containerRef.current
    if (!container) return

    // Scope navigation to the same table (data-grid-table) so arrow keys
    // don't jump between Income and Kharcho, for example.
    const table = target.getAttribute('data-grid-table') ?? ''
    const allCells = Array.from(
      container.querySelectorAll<HTMLElement>('[data-grid-row][data-grid-col]'),
    ).filter((el) => el.offsetParent !== null && (el.getAttribute('data-grid-table') ?? '') === table)

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Find all rows that have this column
      const sameCol = allCells
        .filter((el) => Number(el.getAttribute('data-grid-col')) === col)
        .sort((a, b) => Number(a.getAttribute('data-grid-row')) - Number(b.getAttribute('data-grid-row')))

      const idx = sameCol.findIndex((el) => Number(el.getAttribute('data-grid-row')) === row)
      const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1
      const nextEl = sameCol[nextIdx]
      if (nextEl) focusCell(nextEl, lockedRef.current)
    } else {
      // Left/Right: find all columns in this row
      const sameRow = allCells
        .filter((el) => Number(el.getAttribute('data-grid-row')) === row)
        .sort((a, b) => Number(a.getAttribute('data-grid-col')) - Number(b.getAttribute('data-grid-col')))

      const idx = sameRow.findIndex((el) => Number(el.getAttribute('data-grid-col')) === col)
      const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1
      const nextEl = sameRow[nextIdx]
      if (nextEl) focusCell(nextEl, lockedRef.current)
    }
  }, [])

  return { containerRef, onKeyDown }
}

function focusCell(el: HTMLElement, onLockedCell?: () => void) {
  if (el.getAttribute('data-grid-locked') !== null) {
    onLockedCell?.()
    return
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.focus()
    el.select()
  } else {
    // It's a button (locked cell) — click it to trigger unlock
    el.click()
  }
}
