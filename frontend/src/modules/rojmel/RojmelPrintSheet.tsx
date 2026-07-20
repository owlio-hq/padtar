import type { CarryForwardLine, MoneyLine, SalesLine } from './types'

/**
 * Print-only structured sheet for a Rojmel day.
 *
 * The interactive form prints badly (the date shows as an input box, and a long
 * Kharcho list shoves the Notes onto a second page). So instead of restyling the
 * live form, we render this clean document — hidden on screen, shown only when
 * printing (see `.print-sheet` / `@media print` in index.css). Income and Kharcho
 * sit side by side so a long Kharcho list grows sideways, not down, keeping Notes
 * and Carry-forward on the same page.
 */

type ComputedSalesLine = SalesLine & { total: number; net_pic: number }

function parseNotes(value: string | null): [string, string][] {
  if (!value || !value.trim()) return []
  try {
    const data = JSON.parse(value)
    if (Array.isArray(data)) {
      return data
        .filter((r) => Array.isArray(r))
        .map((r): [string, string] => [String(r[0] ?? ''), String(r[1] ?? '')])
        .filter(([a, b]) => a.trim() || b.trim())
    }
  } catch {
    /* legacy plain text */
  }
  return [[value, '']]
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** One money table (Income or Kharcho): Amount | Description | Note. */
function MoneyBlock({ lines }: { lines: MoneyLine[] }) {
  if (lines.length === 0) return <div className="ps-empty">—</div>
  return (
    <table className="ps-table">
      <tbody>
        {lines.map((m, i) => (
          <tr key={i}>
            <td className="ps-num">{fmt(m.amount)}</td>
            <td>{m.description}</td>
            <td>{m.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function RojmelPrintSheet({
  date,
  lines,
  factorySales,
  incomeLines,
  expenseLines,
  totalIncome,
  totalExpense,
  cashOnHand,
  notes,
  carryForward,
}: {
  date: string
  lines: ComputedSalesLine[]
  factorySales: number
  incomeLines: MoneyLine[]
  expenseLines: MoneyLine[]
  totalIncome: number
  totalExpense: number
  cashOnHand: number
  notes: string | null
  carryForward: CarryForwardLine[]
}) {
  const noteRows = parseNotes(notes)

  return (
    <div className="print-sheet">
      <div className="ps-head">
        <div className="ps-title">Rojmel — Daily Sales &amp; Cash</div>
        <div className="ps-date">{fmtDate(date)}</div>
      </div>

      <table className="ps-table">
        <thead>
          <tr>
            <th>Product</th>
            <th className="ps-num">Rate</th>
            <th className="ps-num">Sales</th>
            <th className="ps-num">OPP.PIC</th>
            <th className="ps-num">CLO.PIC</th>
            <th className="ps-num">NET.PIC</th>
            <th className="ps-num">Total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((s, i) => (
            <tr key={i}>
              <td>{s.product}</td>
              <td className="ps-num">{s.rate || 0}</td>
              <td className="ps-num">{s.qty || 0}</td>
              <td className="ps-num">{s.opening_pic || 0}</td>
              <td className="ps-num">{s.closing_pic || 0}</td>
              <td className="ps-num">{s.net_pic}</td>
              <td className="ps-num">{fmt(s.total)}</td>
            </tr>
          ))}
          <tr className="ps-total-row">
            <td colSpan={6}>Factory Sales</td>
            <td className="ps-num">{fmt(factorySales)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount first, matching the on-screen order */}
      <div className="ps-money">
        <div className="ps-money-col">
          <div className="ps-subhead">Income</div>
          <MoneyBlock lines={incomeLines} />
        </div>
        <div className="ps-money-col">
          <div className="ps-subhead">Kharcho</div>
          <MoneyBlock lines={expenseLines} />
        </div>
      </div>

      <div className="ps-summary">
        <span>
          Income: <b>{fmt(totalIncome)}</b>
        </span>
        <span>
          Kharcho: <b>{fmt(totalExpense)}</b>
        </span>
        <span>
          Cash on Hand: <b>{fmt(cashOnHand)}</b>
        </span>
      </div>

      {/* Carry Forward on the LEFT, Notes on the RIGHT (swapped per client) */}
      <div className="ps-two">
        <div className="ps-block">
          <div className="ps-subhead">Carry Forward</div>
          {carryForward.length > 0 ? (
            <table className="ps-table">
              <tbody>
                {carryForward.map((c, i) => (
                  <tr key={i}>
                    <td className="ps-num">{fmt(c.amount)}</td>
                    <td>{c.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ps-empty">—</div>
          )}
        </div>
        <div className="ps-block">
          <div className="ps-subhead">Notes</div>
          {noteRows.length > 0 ? (
            <table className="ps-table">
              <tbody>
                {/* stored as [note, detail]; detail is the amount, shown first */}
                {noteRows.map(([note, detail], i) => (
                  <tr key={i}>
                    <td className="ps-num">{detail}</td>
                    <td>{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ps-empty">—</div>
          )}
        </div>
      </div>
    </div>
  )
}
