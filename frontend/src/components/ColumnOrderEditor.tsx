import { useState, useRef } from 'react'
import { GripVertical, X } from 'lucide-react'

export interface ColumnDef {
  key: string
  label: string
}

interface Props {
  columns: ColumnDef[]
  order: string[]
  onSave: (newOrder: string[]) => void
  onClose: () => void
}

export function ColumnOrderEditor({ columns, order, onSave, onClose }: Props) {
  const colMap = Object.fromEntries(columns.map((c) => [c.key, c]))
  const [items, setItems] = useState(() => order.filter((k) => colMap[k]))
  const dragIdx = useRef<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function handleDragStart(i: number) {
    dragIdx.current = i
  }
  function handleDragOver(e: React.DragEvent, i: number) {
    e.preventDefault()
    setOverIdx(i)
  }
  function handleDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) { setOverIdx(null); return }
    const next = [...items]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(i, 0, moved)
    setItems(next)
    dragIdx.current = null
    setOverIdx(null)
  }
  function handleDragEnd() {
    dragIdx.current = null
    setOverIdx(null)
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Reorder columns
          </h3>
          <button onClick={onClose} className="icon-btn" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Drag to reorder. Changes are saved instantly.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {items.map((key, i) => (
            <li
              key={key}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={handleDragEnd}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm"
              style={{
                color: 'var(--text)',
                background: overIdx === i ? 'var(--hover)' : 'transparent',
                cursor: 'grab',
                borderBottom: '1px solid var(--border)',
                userSelect: 'none',
              }}
            >
              <GripVertical size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              {colMap[key]?.label ?? key}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex gap-2 justify-end">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent btn-sm" onClick={() => { onSave(items); onClose() }}>
            Save order
          </button>
        </div>
      </div>
    </div>
  )
}
