import { useEffect, useRef, useState } from 'react'
import { Plus, StickyNote, Trash2 } from 'lucide-react'

type Row = [string, string]

const MAX_ROWS = 60

/** Parse the stored notes string: JSON [[note, detail], …] or legacy plain text. */
function parseRows(value: string | null): Row[] {
  if (!value || !value.trim()) return [['', '']]
  try {
    const data = JSON.parse(value)
    if (Array.isArray(data)) {
      const rows = data
        .filter((r) => Array.isArray(r))
        .map((r): Row => [String(r[0] ?? ''), String(r[1] ?? '')])
      return rows.length ? rows : [['', '']]
    }
  } catch {
    /* legacy plain text */
  }
  return [[value, '']]
}

function serialize(rows: Row[]): string {
  const kept = rows.filter(([a, b]) => a.trim() || b.trim())
  return kept.length ? JSON.stringify(kept) : ''
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * 2-column, row-wise notes (e.g. "carry forward | 23820"). Each cell wraps and
 * grows downward as you type — no sideways scrolling. Stored as JSON in the
 * existing notes field; exports print one Excel/PDF row per line.
 */
export function NotesGrid({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [rows, setRows] = useState<Row[]>(() => parseRows(value))
  const loadedFor = useRef(value)

  // Re-sync when a different entry loads (value changed from outside).
  useEffect(() => {
    if (value !== loadedFor.current && value !== serialize(rows)) {
      loadedFor.current = value
      setRows(parseRows(value))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(next: Row[]) {
    setRows(next)
    const s = serialize(next)
    loadedFor.current = s || null
    onChange(s || null)
  }

  function update(i: number, col: 0 | 1, text: string) {
    commit(rows.map((r, idx) => (idx === i ? ((col === 0 ? [text, r[1]] : [r[0], text]) as Row) : r)))
  }

  return (
    <div className="card mt-5 p-4">
      <label className="mb-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
        <StickyNote size={15} />
        Notes
      </label>
      <div className="notes-grid-head">
        <span>Note</span>
        <span>Detail / Amount</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="notes-grid-row reveal-row">
          <textarea
            className="field notes-cell"
            rows={1}
            value={r[0]}
            placeholder="e.g. Carry forward"
            ref={autoGrow}
            onChange={(e) => {
              autoGrow(e.target)
              update(i, 0, e.target.value)
            }}
          />
          <textarea
            className="field notes-cell"
            rows={1}
            value={r[1]}
            placeholder="e.g. 23820"
            ref={autoGrow}
            onChange={(e) => {
              autoGrow(e.target)
              update(i, 1, e.target.value)
            }}
          />
          <button
            className="icon-btn icon-btn-danger reveal-target"
            onClick={() => commit(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [['', '']])}
            aria-label="Remove note row"
            title="Remove this row"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {rows.length < MAX_ROWS && (
        <button className="btn btn-outline btn-sm mt-2" onClick={() => commit([...rows, ['', '']])}>
          <Plus size={13} />
          Add row
        </button>
      )}
    </div>
  )
}
