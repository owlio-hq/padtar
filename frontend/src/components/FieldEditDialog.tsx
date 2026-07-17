import { useState } from 'react'
import { NumberField } from './NumberField'

/**
 * Small popup for editing one locked value (optionally with a unit beside it).
 *
 * Opened straight after the edit password is accepted, so the worker types the
 * value immediately instead of having to click the field a second time. Saving
 * or cancelling always re-locks the field — nothing stays open.
 */
export function FieldEditDialog({
  title,
  label,
  value,
  unit,
  unitLabel = 'Unit',
  onSave,
  onCancel,
}: {
  title: string
  label: string
  value: number
  /** Pass a string to show a second "unit" input next to the number. */
  unit?: string
  unitLabel?: string
  onSave: (value: number, unit?: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(value)
  const [unitVal, setUnitVal] = useState(unit ?? '')

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
          {title}
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(val, unit !== undefined ? unitVal : undefined)
          }}
        >
          <div className={`mt-4 grid gap-3 ${unit !== undefined ? 'grid-cols-2' : ''}`}>
            <div>
              <label className="field-label">{label}</label>
              <NumberField min={0} value={val} onChange={setVal} autoFocus />
            </div>
            {unit !== undefined && (
              <div>
                <label className="field-label">{unitLabel}</label>
                <input className="field" value={unitVal} onChange={(e) => setUnitVal(e.target.value)} placeholder="kg" />
              </div>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
