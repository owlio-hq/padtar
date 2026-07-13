import { useEffect, useRef, useState } from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Scope =
  | { kind: 'current' }
  | { kind: 'all' }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }

interface Props {
  /** Base path e.g. "/api/shakkarpara/batches/export". Suffix "/excel" or "/pdf" is added. */
  basePath: string
  /** Currently applied filter on the list page — used for the "Current view" shortcut. */
  currentYear?: number
  currentMonth?: number
  /** All years present in the data (for the scope chooser). */
  availableYears: number[]
}

/**
 * Export ▾ menu with a scope chooser:
 *   - Current view (uses the list's applied year/month filter)
 *   - All data
 *   - Specific month / year
 * Each scope offers Excel and PDF.
 */
export function ExportMenu({ basePath, currentYear, currentMonth, availableYears }: Props) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>({ kind: 'current' })
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const scopeHref = (fmt: 'excel' | 'pdf'): string => {
    const qs = new URLSearchParams()
    if (scope.kind === 'current') {
      if (currentYear) qs.set('year', String(currentYear))
      if (currentMonth) qs.set('month', String(currentMonth))
    } else if (scope.kind === 'month') {
      qs.set('year', String(scope.year))
      qs.set('month', String(scope.month))
    } else if (scope.kind === 'year') {
      qs.set('year', String(scope.year))
    }
    const suffix = qs.toString() ? `?${qs}` : ''
    return `${basePath}/${fmt}${suffix}`
  }

  const scopeLabel = (): string => {
    if (scope.kind === 'current') {
      if (currentYear && currentMonth) return `${MONTHS[currentMonth - 1]} ${currentYear}`
      if (currentYear) return `Year ${currentYear}`
      if (currentMonth) return `${MONTHS[currentMonth - 1]} — all years`
      return 'All data'
    }
    if (scope.kind === 'all') return 'All data'
    if (scope.kind === 'year') return `Year ${scope.year}`
    return `${MONTHS[scope.month - 1]} ${scope.year}`
  }

  const yearOptions = availableYears.length ? availableYears : [new Date().getFullYear()]

  return (
    <div ref={menuRef} className="relative">
      <button className="btn btn-outline" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Download size={14} />
        Export
        <ChevronDown size={13} />
      </button>
      {open && (
        <div
          className="menu absolute right-0 z-30 mt-1"
          role="menu"
          style={{ minWidth: 300, padding: 12 }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Scope
          </div>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              checked={scope.kind === 'current'}
              onChange={() => setScope({ kind: 'current' })}
            />
            <span>Current view</span>
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              checked={scope.kind === 'all'}
              onChange={() => setScope({ kind: 'all' })}
            />
            <span>All data</span>
          </label>
          <label className="flex items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              checked={scope.kind === 'year'}
              onChange={() => setScope({ kind: 'year', year: yearOptions[0] })}
            />
            <span>Specific year</span>
          </label>
          {scope.kind === 'year' && (
            <div className="mb-1 ml-6">
              <select
                className="field w-auto"
                value={scope.year}
                onChange={(e) => setScope({ kind: 'year', year: Number(e.target.value) })}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 py-1 text-sm">
            <input
              type="radio"
              checked={scope.kind === 'month'}
              onChange={() =>
                setScope({ kind: 'month', year: yearOptions[0], month: new Date().getMonth() + 1 })
              }
            />
            <span>Specific month</span>
          </label>
          {scope.kind === 'month' && (
            <div className="mb-1 ml-6 flex gap-2">
              <select
                className="field w-auto"
                value={scope.month}
                onChange={(e) => setScope({ ...scope, month: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="field w-auto"
                value={scope.year}
                onChange={(e) => setScope({ ...scope, year: Number(e.target.value) })}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-3 text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Exporting: <span style={{ color: 'var(--text)' }}>{scopeLabel()}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={scopeHref('excel')}
              className="btn btn-primary flex-1"
              onClick={() => setOpen(false)}
            >
              <FileSpreadsheet size={14} />
              Excel
            </a>
            <a
              href={scopeHref('pdf')}
              className="btn btn-outline flex-1"
              onClick={() => setOpen(false)}
            >
              <FileText size={14} />
              PDF
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
