import { useState } from 'react'
import type { SalesLine } from './types'
import { NumberField } from '../../components/NumberField'

export type ApplyMode = 'sheet' | 'default'

/**
 * Edits a product's name + rate. Shown only after the edit password is verified.
 * Offers "this sheet only" vs "also set as default" so a rate change persists to
 * future days.
 */
export function ProductEditDialog({
  product,
  isNewRow,
  onSave,
  onCancel,
}: {
  product: SalesLine
  isNewRow?: boolean
  onSave: (patch: { product: string; rate: number }, mode: ApplyMode) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(product.product)
  const [rate, setRate] = useState(product.rate)
  const [mode, setMode] = useState<ApplyMode>('sheet')

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h2 className="text-base font-medium" style={{ color: 'var(--text)' }}>
          {isNewRow ? 'Add product' : 'Edit product'}
        </h2>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="field-label">Product name</label>
            <input autoFocus className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Rate (₹)</label>
            <NumberField value={rate} onChange={setRate} />
          </div>
        </div>

        <div className="mt-4">
          <div className="field-label">Apply this change to</div>
          <label className="mb-1 flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={mode === 'sheet'} onChange={() => setMode('sheet')} />
            This day only
          </label>
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
            <input type="radio" checked={mode === 'default'} onChange={() => setMode('default')} />
            Also set as default for future days
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => onSave({ product: name, rate }, mode)}>
            {isNewRow ? 'Add' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
