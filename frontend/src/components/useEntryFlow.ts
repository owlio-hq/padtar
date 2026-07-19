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
 */
export function useEntryFlow<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (!target.matches?.('[data-entry-flow]')) return
    e.preventDefault() // don't submit anything

    const group = target.getAttribute('data-entry-flow')
    const boxes = Array.from(
      containerRef.current?.querySelectorAll<HTMLInputElement>('[data-entry-flow]') ?? [],
    ).filter((el) => !el.disabled && el.offsetParent !== null && el.getAttribute('data-entry-flow') === group)

    const next = boxes[boxes.indexOf(target as HTMLInputElement) + 1]
    if (next) {
      next.focus()
      next.select()
    } else {
      target.blur() // last box — finish the run
    }
  }, [])

  return { containerRef, onKeyDown }
}
