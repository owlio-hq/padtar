import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { shakkarparaApi } from './api'

const RECAP_LIMIT = 10

/**
 * "—" for a missing value, so a renamed ingredient row reads as absent rather than 0.
 * Shows up to 2 decimals but never pads them on: rates read as "2,350", while a real
 * production of 719.85 must NOT be rounded to "720" — the client reads these against
 * their own sheet and a rounded figure looks like a wrong figure.
 */
function num(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

/**
 * Read-only glance at the last 10 batches, shown on the batch sheet itself.
 *
 * The client tracks these few numbers by eye while entering a new batch and doesn't
 * want to leave the page to check them. Collapsed by default so it never pushes the
 * entry form down; screen-only (deliberately not on the print sheet or the exports —
 * it is a typing aid, not part of the batch record).
 *
 * Both oil rates are listed because they are separately typed cells that genuinely
 * differ on a chunk of the client's real sheets — only Oil Vaprayel's *usage* is
 * auto-filled from the Oil Sheet, never its rate.
 */
export function RecentBatchesPanel({ excludeId }: { excludeId?: number }) {
  const [open, setOpen] = useState(false)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['shakkarpara-recap', RECAP_LIMIT, excludeId ?? null],
    queryFn: () => shakkarparaApi.recap(RECAP_LIMIT, excludeId),
    enabled: open, // nothing is fetched until they actually open it
  })

  return (
    <div className="card recap-card mb-5 overflow-hidden">
      <button
        className="recap-strip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Recent batches, for reference while entering this one"
      >
        <span className="recap-title">
          <History size={15} />
          Last {RECAP_LIMIT} batches
        </span>
        <span className="recap-tag">reference</span>
        <span className="recap-chevron">{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
      </button>

      {open && (
        <table className="data-table entry-table">
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th className="num-right" title="Rate on the Oil row (Lot Bandhta)">Oil rate</th>
              <th className="num-right" title="Rate on the Oil Vaprayel row (Dabba) — typed separately from the Oil rate">
                Oil vaprayel
              </th>
              <th className="num-right" title="Rate on the Menda row (per Katta)">Menda rate</th>
              <th className="num-right" title="Vaprash on the Menda row, in Katta">Menda katta</th>
              <th className="num-right">Production</th>
              <th className="col-total-head">Padtar</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px' }}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows?.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px' }}>
                  No earlier batches yet.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 500 }}>{fmtDate(r.date)}</td>
                <td className="num-right">{num(r.oil_rate)}</td>
                <td className="num-right">{num(r.oil_vaprayel_rate)}</td>
                <td className="num-right">{num(r.menda_rate)}</td>
                <td className="num-right">{num(r.menda_katta)}</td>
                <td className="num-right">{num(r.production_qty)}</td>
                <td className="col-total">{r.padtar !== null ? r.padtar.toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
