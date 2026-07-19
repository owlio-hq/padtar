import { useEffect, useState } from 'react'

interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  onBlur?: () => void
  className?: string
  step?: string
  placeholder?: string
  ariaLabel?: string
  /** Clamp typed values below this to it (e.g. 0 to block negatives). */
  min?: number
  /**
   * Marks this as a day-to-day entry box, so pressing Enter jumps to the next
   * one (see the Enter handler on the batch/day forms). Pass a string to keep a
   * column in its own vertical run — e.g. Opening jumps to the next Opening, not
   * across to Closing. `true` uses the default (unnamed) group.
   */
  entryFlow?: boolean | string
  /** Focus + select on mount (used by popups so the value is typeable at once). */
  autoFocus?: boolean
}

/**
 * Numeric input where 0 behaves like a placeholder, not a stuck value.
 * - shows empty (with a muted "0" placeholder) when the value is 0
 * - selects all on focus so typing replaces cleanly (no "10"/"01" from a leftover 0)
 * - treats empty as 0 on change
 * - keeps a local text buffer so partial input like "1." works while typing
 * - with min set, values below it clamp on blur (typing stays free mid-edit)
 */
export function NumberField({
  value,
  onChange,
  onBlur,
  className = 'field',
  step = 'any',
  placeholder = '0',
  ariaLabel,
  min,
  entryFlow,
  autoFocus,
}: NumberFieldProps) {
  const [text, setText] = useState(value === 0 ? '' : String(value))

  // sync when the value changes from outside (e.g. loading an existing entry,
  // oil-sit auto usage), but don't clobber what the user is mid-typing.
  useEffect(() => {
    const parsed = text === '' ? 0 : Number(text)
    if (parsed !== value) setText(value === 0 ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function clamp(n: number): number {
    if (min !== undefined && Number.isFinite(n) && n < min) return min
    return n
  }

  return (
    <input
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
      data-entry-flow={entryFlow === undefined || entryFlow === false ? undefined : typeof entryFlow === 'string' ? entryFlow : ''}
      autoFocus={autoFocus}
      value={text}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        const parsed = text === '' ? 0 : Number(text)
        const clamped = clamp(parsed)
        if (clamped !== parsed) {
          setText(clamped === 0 ? '' : String(clamped))
          onChange(clamped)
        }
        onBlur?.()
      }}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        onChange(raw === '' ? 0 : clamp(Number(raw)))
      }}
    />
  )
}
