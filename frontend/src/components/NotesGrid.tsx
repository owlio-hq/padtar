import { useEffect, useRef, useState } from 'react'
import { Plus, StickyNote, Trash2 } from 'lucide-react'

/** Stored shape stays [note, detail] — see the render note below. */
type Row = [string, string]

const MAX_ROWS = 60
const MIN_ROWS = 3 // always leave a few open lines to type into

/** Parse the stored notes string: JSON [[note, detail], …] or legacy plain text. */
function parseRows(value: string | null): Row[] {
  if (!value || !value.trim()) return []
  try {
    const data = JSON.parse(value)
    if (Array.isArray(data)) {
      return data.filter((r) => Array.isArray(r)).map((r): Row => [String(r[0] ?? ''), String(r[1] ?? '')])
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

/** Pad out to MIN_ROWS so there are always blank lines ready to type into. */
function padded(rows: Row[]): Row[] {
  const out = [...rows]
  while (out.length < MIN_ROWS) out.push(['', ''])
  return out
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * 2-column notes (e.g. "23820 | carry forward").
 *
 * Displayed AMOUNT first, then the note — that's the order the client types in.
 * The stored pair stays [note, detail] so notes typed on older versions keep
 * working; only the render order is swapped (detail = index 1 = the amount).
 *
 * Enter walks straight down its own column (amounts stay with amounts); Tab
 * moves across the row, which is the native behaviour given the DOM order.
 * A cell is tinted amber only when its row has been started but this cell is
 * still empty — a nudge, never a requirement.
 */
export function NotesGrid({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [rows, setRows] = useState<Row[]>(() => padded(parseRows(value)))
  const loadedFor = useRef(value)

  // Re-sync when a different entry loads (value changed from outside).
  useEffect(() => {
    if (value !== loadedFor.current && value !== serialize(rows)) {
      loadedFor.current = value
      setRows(padded(parseRows(value)))
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
    <div className="card notes-card mt-5 p-4">
      <label className="mb-2 flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text)' }}>
        <StickyNote size={15} />
        Notes
      </label>
      <div className="notes-grid-head">
        <span>Amount</span>
        <span>Note</span>
        <span />
      </div>
      {rows.map((r, i) => {
        const [note, amount] = r
        const started = note.trim() !== '' || amount.trim() !== ''
        return (
          <div key={i} className="notes-grid-row reveal-row">
            <textarea
              className={`field notes-cell amt-cell${started && !amount.trim() ? ' is-missing' : ''}`}
              rows={1}
              value={amount}
              placeholder="e.g. 23820"
              data-entry-flow="note-amt"
              ref={autoGrow}
              onChange={(e) => {
                autoGrow(e.target)
                update(i, 1, e.target.value)
              }}
            />
            <textarea
              className={`field notes-cell${started && !note.trim() ? ' is-missing' : ''}`}
              rows={1}
              value={note}
              placeholder="e.g. Chirag bhai"
              data-entry-flow="note-txt"
              ref={autoGrow}
              onChange={(e) => {
                autoGrow(e.target)
                update(i, 0, e.target.value)
              }}
            />
            <button
              className="icon-btn icon-btn-danger reveal-target"
              onClick={() => commit(rows.length > MIN_ROWS ? rows.filter((_, idx) => idx !== i) : padded(rows.filter((_, idx) => idx !== i)))}
              aria-label="Remove note row"
              title="Remove this row"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
      {rows.length < MAX_ROWS && (
        <button className="btn btn-outline btn-sm mt-2" onClick={() => commit([...rows, ['', '']])}>
          <Plus size={13} />
          Add row
        </button>
      )}
      {/* print-only: ruled blank space so the printed sheet has real room to write
          more notes by hand, instead of ending abruptly after the last row */}
      <div className="notes-fill" />
    </div>
  )
}
