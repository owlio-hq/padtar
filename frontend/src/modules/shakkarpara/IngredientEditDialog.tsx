import { useState } from 'react'
import type { Ingredient } from './types'
import { NumberField } from '../../components/NumberField'

export type ApplyMode = 'sheet' | 'default'

/**
 * Edits an ingredient's structural fields (name, rate, unit). Shown only after
 * the edit password is verified. Offers "this sheet only" vs "also set as
 * default" so a rate/unit change can persist to future batches.
 */
export function IngredientEditDialog({
  ingredient,
  isNewRow,
  onSave,
  onCancel,
}: {
  ingredient: Ingredient
  isNewRow?: boolean
  onSave: (patch: Pick<Ingredient, 'name' | 'rate' | 'unit'>, mode: ApplyMode) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(ingredient.name)
  const [rate, setRate] = useState(ingredient.rate)
  const [unit, setUnit] = useState(ingredient.unit)
  const [mode, setMode] = useState<ApplyMode>('sheet')

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
          {isNewRow ? 'Add ingredient' : 'Edit ingredient'}
        </h2>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="field-label">Ingredient name</label>
            <input autoFocus className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Rate (₹)</label>
              <NumberField min={0} value={rate} onChange={setRate} />
            </div>
            <div>
              <label className="field-label">Unit</label>
              <input className="field" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. Kg" />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="field-label">Apply this change to</div>
          <label className="mb-1 flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={mode === 'sheet'} onChange={() => setMode('sheet')} />
            This sheet only
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={mode === 'default'} onChange={() => setMode('default')} />
            Also set as default for future batches
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({ name, rate, unit }, mode)}>
            {isNewRow ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
