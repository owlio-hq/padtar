import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, FileSpreadsheet, FileText, Printer, Pencil, Lock, Save,
  ShoppingCart, TrendingUp, TrendingDown, Calendar, Wallet, HandCoins, type LucideIcon,
} from 'lucide-react'
import { rojmelApi } from './api'
import { computeDay } from './calc'
import type { CarryForwardLine, DayInput, MoneyLine, SalesLine } from './types'
import { ProductEditDialog, type ApplyMode } from './ProductEditDialog'
import { RojmelPrintSheet } from './RojmelPrintSheet'
import { useAuth } from '../../auth/AuthContext'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FieldEditDialog } from '../../components/FieldEditDialog'
import { NumberField } from '../../components/NumberField'
import { NotesGrid } from '../../components/NotesGrid'
import { useEntryFlow } from '../../components/useEntryFlow'
import { useUnsavedGuard } from '../../components/useUnsavedGuard'
import { useSaveShortcut } from '../../components/useSaveShortcut'
import { saveExport } from '../../system/saveExport'
import { useColumnOrder } from '../../components/useColumnOrder'
import { ColumnOrderEditor, type ColumnDef } from '../../components/ColumnOrderEditor'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

const STOCK_UNLOCK_MS = 5 * 60 * 1000

const MIN_MONEY_ROWS = 4 // always leave open lines to type into

/** True once anything in the row has been filled in. */
function moneyRowStarted(l: MoneyLine): boolean {
  return l.amount !== 0 || l.description.trim() !== '' || l.note.trim() !== ''
}

function MoneyLinesEditor({
  title,
  color,
  icon: Icon,
  flow,
  gridTable,
  lines,
  onChange,
}: {
  title: string
  color: string
  icon: LucideIcon
  /** entry-flow group so Enter walks down THIS table's amount column only */
  flow: string
  /** Scopes arrow-key grid navigation to this table */
  gridTable: string
  lines: MoneyLine[]
  onChange: (lines: MoneyLine[]) => void
}) {
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)

  // Show at least MIN_MONEY_ROWS. The padding is display-only — buildPayload
  // strips fully-empty rows, so nothing blank is ever saved or exported.
  const shown: MoneyLine[] = [...lines]
  while (shown.length < MIN_MONEY_ROWS) shown.push({ description: '', amount: 0, note: '' })

  function update(i: number, patch: Partial<MoneyLine>) {
    const next = [...shown]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }
  function add() {
    onChange([...shown, { description: '', amount: 0, note: '' }])
  }
  function remove(i: number) {
    onChange(shown.filter((_, idx) => idx !== i))
  }

  return (
    <div className="flex-1">
      <div className="card category-card overflow-hidden" style={{ '--cat': color } as React.CSSProperties}>
        <div className="category-strip">
          <span className="category-title">
            <Icon size={16} />
            {title}
          </span>
          <button onClick={add} className="btn btn-cat btn-sm" style={{ borderWidth: 1, borderStyle: 'solid' }} title="Add a line">
            <Plus size={13} />
            Add line
          </button>
        </div>
        {/* Amount first (the order they type in), then the wide Description,
            then a compact Note. Each column gets its own band + divider.
            Description is the column that actually needs room, so Note is kept
            tight (with reduced input padding, see .money-table td.col-note). */}
        <table className="data-table entry-table money-table">
          <colgroup>
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 110 }} />
            <col style={{ width: 48 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-amt amt-cell">Amount (₹)</th>
              <th>Description</th>
              <th className="col-note">Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => {
              const started = moneyRowStarted(l)
              return (
                <tr key={i} className="reveal-row">
                  {/* the missing-hint lives on the CELL, not the input: number
                      inputs don't reliably paint a background, and lighting the
                      whole cell is easier to spot anyway */}
                  <td className={`col-amt${started && l.amount === 0 ? ' is-missing' : ''}`}>
                    <NumberField
                      className="field-inline amt-cell"
                      value={l.amount}
                      onChange={(v) => update(i, { amount: v })}
                      ariaLabel="Amount"
                      entryFlow={flow}
                      gridRow={i}
                      gridCol={0}
                      gridTable={gridTable}
                      placeholder={i === 0 ? '0' : ''}
                    />
                  </td>
                  <td className={`cell-edit${started && !l.description.trim() ? ' is-missing' : ''}`}>
                    <input
                      className="field-inline"
                      value={l.description}
                      onChange={(e) => update(i, { description: e.target.value })}
                      placeholder={i === 0 ? 'What for…' : ''}
                      data-grid-row={i}
                      data-grid-col={1}
                      data-grid-table={gridTable}
                    />
                  </td>
                  <td className={`col-note${started && !l.note.trim() ? ' is-missing' : ''}`}>
                    <input
                      className="field-inline"
                      value={l.note}
                      onChange={(e) => update(i, { note: e.target.value })}
                      placeholder={i === 0 ? 'Note' : ''}
                      data-grid-row={i}
                      data-grid-col={2}
                      data-grid-table={gridTable}
                    />
                  </td>
                  <td className="col-actions">
                    <button onClick={() => setPendingRemove(i)} className="icon-btn icon-btn-danger reveal-target" aria-label="Remove line" title="Remove line">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove line?"
        message="This line will be removed."
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemove !== null) remove(pendingRemove)
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}

export function DayFormPage() {
  const { id } = useParams()
  const isNew = id === 'new' || id === undefined
  const dayId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLabels()
  const { requireEdit, lockEdit } = useAuth()
  const entryFlow = useEntryFlow<HTMLDivElement>(unlockStock)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRemoveSales, setPendingRemoveSales] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null)
  const [cfEdit, setCfEdit] = useState<number | null>(null)
  const [stockUnlocked, setStockUnlocked] = useState(false)
  const stockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingFocusRef = useRef<{ table: string; row: number; col: number } | null>(null)

  useEffect(() => {
    const pf = pendingFocusRef.current
    if (!pf || !stockUnlocked) return
    pendingFocusRef.current = null
    requestAnimationFrame(() => {
      const el = entryFlow.containerRef.current?.querySelector<HTMLElement>(
        `[data-grid-table="${pf.table}"][data-grid-row="${pf.row}"][data-grid-col="${pf.col}"]:not([data-grid-locked])`,
      )
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus()
        el.select()
      } else if (el) {
        el.focus()
      }
    })
  }, [stockUnlocked, entryFlow.containerRef])

  const { data: existing } = useQuery({
    queryKey: ['rojmel-day', dayId],
    queryFn: () => rojmelApi.get(dayId as number),
    enabled: !isNew,
  })

  const { data: defaultProducts } = useQuery({
    queryKey: ['rojmel-default-products'],
    queryFn: () => rojmelApi.getDefaults(),
  })

  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [salesLines, setSalesLines] = useState<SalesLine[]>([])
  const [incomeLines, setIncomeLines] = useState<MoneyLine[]>([])
  const [expenseLines, setExpenseLines] = useState<MoneyLine[]>([])
  const [carryForward, setCarryForward] = useState<CarryForwardLine[]>([])
  const [tallyInputs, setTallyInputs] = useState<number[]>([])
  const [showColEditor, setShowColEditor] = useState(false)

  const SALES_COL_DEFAULT = useMemo(() => ['rate', 'opp', 'clo', 'net', 'sales', 'net_sales', 'total'], [])
  const { order: salesColOrder, saveOrder: saveSalesColOrder } = useColumnOrder('rojmel_sales', SALES_COL_DEFAULT)

  const SALES_COL_DEFS: ColumnDef[] = useMemo(() => [
    { key: 'rate', label: 'Rate (₹)' },
    { key: 'opp', label: 'OPP.PIC' },
    { key: 'clo', label: 'CLO.PIC' },
    { key: 'net', label: 'NET.PIC' },
    { key: 'sales', label: 'Sales' },
    { key: 'net_sales', label: 'NET.SALES' },
    { key: 'total', label: 'Total' },
  ], [])

  const seeded = useRef(false)
  // Set once the worker touches the carry-forward rows or the notes, so changing
  // the date afterwards never overwrites what they already typed.
  const inheritTouched = useRef(false)
  const [inheritSeeded, setInheritSeeded] = useState(false)

  useEffect(() => {
    if (!isNew || seeded.current || !defaultProducts) return
    seeded.current = true
    setSalesLines(defaultProducts.map((p) => ({ product: p.name, rate: p.rate, qty: 0, opening_pic: 0, closing_pic: 0 })))
  }, [isNew, defaultProducts])

  // Carry forward + notes roll over from the most recent day BEFORE this one
  // (so a skipped Sunday doesn't break the chain). Forward-only: this is a copy,
  // and nothing done here ever reaches back to change the source day.
  const { data: carryIn } = useQuery({
    queryKey: ['rojmel-carry-in', date],
    queryFn: () => rojmelApi.carryIn(date),
    enabled: isNew && !!date,
  })

  useEffect(() => {
    if (!isNew || !carryIn || inheritTouched.current || !seeded.current) return
    setCarryForward(
      (carryIn.carry_forward_lines ?? []).map((c) => ({ name: c.name, amount: c.amount, carry_forward: false })),
    )
    setNotes(carryIn.notes ?? '')
    if (carryIn.stock_opening?.length) {
      const stockMap = new Map(carryIn.stock_opening.map((s) => [s.product, s.opening_pic]))
      setSalesLines((prev) =>
        prev.map((line) => ({ ...line, opening_pic: stockMap.get(line.product) ?? line.opening_pic })),
      )
    }
    setInheritSeeded(true)
  }, [isNew, carryIn, defaultProducts])

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setNotes(existing.notes ?? '')
    setSalesLines(existing.sales_lines)
    setIncomeLines(existing.income_lines)
    setExpenseLines(existing.expense_lines)
    setCarryForward(existing.carry_forward_lines)
  }, [existing])

  useEffect(() => () => clearTimeout(stockTimer.current), [])

  const { lines, factorySales, totalIncome, totalExpense, cashOnHand } = computeDay(salesLines, incomeLines, expenseLines)

  // Latest values, reachable from the mutation callback below.
  const dirtyKeyRef = useRef('')
  const markSavedRef = useRef<(snapshot?: string) => void>(() => {})

  const saveMutation = useMutation({
    mutationFn: (payload: DayInput) => (isNew ? rojmelApi.create(payload) : rojmelApi.update(dayId as number, payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['rojmel-days'] })
      queryClient.invalidateQueries({ queryKey: ['rojmel-day', saved.id] })
      queryClient.invalidateQueries({ queryKey: ['rojmel-history', saved.id] })
      markSavedRef.current(dirtyKeyRef.current) // sheet is clean again
      navigate(`/rojmel/${saved.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => rojmelApi.remove(dayId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rojmel-days'] })
      navigate('/rojmel')
    },
  })

  useEffect(() => {
    setTallyInputs((prev) => {
      if (prev.length === salesLines.length) return prev
      const next = new Array(salesLines.length).fill(0)
      for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i]
      return next
    })
  }, [salesLines.length])

  function updateSalesLine(i: number, patch: Partial<SalesLine>) {
    setSalesLines((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function updateTally(i: number, value: number) {
    setTallyInputs((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  function handleTallyEnter(i: number, e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const tallyValue = tallyInputs[i] || 0
    if (tallyValue === 0) return
    updateSalesLine(i, { qty: (salesLines[i].qty || 0) + tallyValue })
    updateTally(i, 0)
  }

  // ---- password-gated structural actions ----
  async function openEditProduct(index: number) {
    if (await requireEdit()) setEditing({ index, isNew: false })
  }
  async function openAddProduct() {
    if (!(await requireEdit())) return
    setSalesLines((rows) => [...rows, { product: '', rate: 0, qty: 0, opening_pic: 0, closing_pic: 0 }])
    setEditing({ index: salesLines.length, isNew: true })
  }
  async function requestRemoveSales(index: number) {
    if (await requireEdit()) setPendingRemoveSales(index)
  }
  async function requestDeleteDay() {
    if (await requireEdit()) setConfirmDelete(true)
  }

  // Opening (OPP.PIC) is locked in its own 'stock' scope so unlocking it does NOT
  // loosen rate edits. One unlock keeps every opening cell editable for 5 minutes.
  async function unlockStock(e?: React.MouseEvent) {
    if (e?.currentTarget instanceof HTMLElement) {
      const t = e.currentTarget
      const row = t.getAttribute('data-grid-row')
      const col = t.getAttribute('data-grid-col')
      const table = t.getAttribute('data-grid-table')
      if (row && col) pendingFocusRef.current = { table: table ?? '', row: Number(row), col: Number(col) }
    }
    if (!(await requireEdit('stock'))) { pendingFocusRef.current = null; return }
    setStockUnlocked(true)
    clearTimeout(stockTimer.current)
    stockTimer.current = setTimeout(() => {
      setStockUnlocked(false)
      lockEdit('stock')
    }, STOCK_UNLOCK_MS)
  }

  async function applyProductEdit(index: number, patch: { product: string; rate: number }, mode: ApplyMode) {
    const oldName = salesLines[index]?.product
    setSalesLines((rows) => rows.map((row, idx) => (idx === index ? { ...row, ...patch } : row)))
    if (mode === 'default') {
      const current = await rojmelApi.getDefaults()
      const next = current.map((d) => ({ ...d }))
      const match = next.find((d) => d.name === oldName)
      if (match) {
        match.name = patch.product
        match.rate = patch.rate
      } else {
        next.push({ name: patch.product, rate: patch.rate })
      }
      await rojmelApi.setDefaults(next)
      queryClient.invalidateQueries({ queryKey: ['rojmel-default-products'] })
    }
    setEditing(null)
  }

  // ---- carry-forward: name is free-edit, amount is locked behind the admin password ----
  function updateCarry(i: number, patch: Partial<CarryForwardLine>) {
    inheritTouched.current = true
    setCarryForward((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }
  async function openCarryAmount(index: number) {
    if (await requireEdit()) setCfEdit(index)
  }
  function closeCarryAmount() {
    setCfEdit(null)
    lockEdit() // re-lock immediately, next amount edit re-prompts
  }
  async function removeCarry(index: number) {
    if (!(await requireEdit())) return
    inheritTouched.current = true
    setCarryForward((rows) => rows.filter((_, i) => i !== index))
  }

  function addCarry() {
    inheritTouched.current = true
    setCarryForward((rows) => [...rows, { name: '', amount: 0, carry_forward: false }])
  }

  function updateNotes(v: string | null) {
    inheritTouched.current = true
    setNotes(v ?? '')
  }

  // Shown inside the Carry Forward table only. Deliberately NOT part of income,
  // kharcho or cash on hand — it mirrors the informational block that sits below
  // the totals in the client's Excel.
  const carryForwardTotal = carryForward.reduce((sum, c) => sum + c.amount, 0)

  function buildPayload(): DayInput {
    // The editors always show a few blank rows to type into — never save them.
    const usedMoney = (rows: MoneyLine[]) => rows.filter(moneyRowStarted)
    return {
      date,
      notes: notes || null,
      sales_lines: salesLines,
      income_lines: usedMoney(incomeLines),
      expense_lines: usedMoney(expenseLines),
      carry_forward_lines: carryForward.filter((c) => c.name.trim() !== '' || c.amount !== 0),
    }
  }

  function handleSave() {
    saveMutation.mutate(buildPayload())
  }
  useSaveShortcut(handleSave, !saveMutation.isPending)

  async function exportFile(kind: 'excel' | 'pdf') {
    const ext = kind === 'excel' ? 'xlsx' : 'pdf'
    await saveExport(`/api/rojmel/days/${dayId}/export/${kind}`, `rojmel_${date}_${dayId}.${ext}`)
  }

  // What the worker actually typed — server-added fields (id, total) are left
  // out, otherwise a refetch after saving would look like a fresh edit.
  const dirtyKey = JSON.stringify({
    date,
    notes,
    sales: salesLines.map((s) => [s.product, s.rate, s.qty, s.opening_pic]),
    income: incomeLines.map((m) => [m.description, m.amount, m.note]),
    expense: expenseLines.map((m) => [m.description, m.amount, m.note]),
    carry: carryForward.map((c) => [c.name, c.amount, c.carry_forward]),
  })
  dirtyKeyRef.current = dirtyKey

  // Guard the sheet: leaving (or an app update) must not silently drop edits.
  const guard = useUnsavedGuard({
    payload: dirtyKey,
    // wait for the inherited carry-forward/notes too, or the baseline snapshots
    // before they land and a freshly opened day reads as unsaved
    ready: isNew ? salesLines.length > 0 && inheritSeeded : !!existing,
    save: async () => {
      await saveMutation.mutateAsync(buildPayload())
    },
  })
  markSavedRef.current = guard.markSaved

  return (
    <>
      {/* no width cap: the shell's max-w-6xl already bounds this, and the extra
          ~150px goes to the tables (Description especially) */}
      <div className="rojmel-screen mx-auto" ref={entryFlow.containerRef} onKeyDown={entryFlow.onKeyDown}>
        <PageHeader
          title={isNew ? 'New day' : `Day — ${date}`}
          subtitle="Daily sales and cash"
          backTo="/rojmel"
          backLabel={t('rojmel.title', 'Rojmed')}
          actions={
            <>
              <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending} title="Save (Ctrl+S)">
                <Save size={14} />
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              {!isNew && (
                <>
                  <button className="btn btn-outline" onClick={() => window.print()} title="Print this day">
                    <Printer size={14} />
                    Print
                  </button>
                  <button className="btn btn-outline" onClick={() => exportFile('excel')} title="Export this day to Excel">
                    <FileSpreadsheet size={14} style={{ color: 'var(--tint-total-text)' }} />
                    Excel
                  </button>
                  <button className="btn btn-outline" onClick={() => exportFile('pdf')} title="Export this day to PDF">
                    <FileText size={14} style={{ color: 'var(--tint-rate-text)' }} />
                    PDF
                  </button>
                  <button className="btn btn-danger" onClick={requestDeleteDay}>
                    <Trash2 size={14} />
                    Delete
                  </button>
                </>
              )}
            </>
          }
        />

        {saveMutation.isError && (
          <div
            className="mb-4 rounded px-3 py-2 text-sm"
            style={{ border: '1px solid var(--tint-negative-text)', color: 'var(--tint-negative-text)', backgroundColor: 'var(--tint-negative-bg)' }}
          >
            {(saveMutation.error as Error).message.includes('409')
              ? 'A Rojmed entry already exists for this date.'
              : 'Could not save — please try again.'}
          </div>
        )}

        {/* Top cards: Date + the three live money figures, like the Shakkarpara header. */}
        <div className="mb-5 grid grid-cols-4 gap-3">
          <div className="field-card" style={{ '--cat': '#94a3b8' } as React.CSSProperties}>
            <label className="field-label flex items-center gap-1.5">
              <Calendar size={13} />
              {t('rojmel.date', 'Date')}
            </label>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="field-card" style={{ '--cat': '#10b981' } as React.CSSProperties}>
            <label className="field-label flex items-center gap-1.5">
              <TrendingUp size={13} />
              {t('rojmel.income', 'Income')} (₹)
            </label>
            <div className="field readonly-value">{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="field-card" style={{ '--cat': '#ef4444' } as React.CSSProperties}>
            <label className="field-label flex items-center gap-1.5">
              <TrendingDown size={13} />
              {t('rojmel.expense', 'Kharcho')} (₹)
            </label>
            <div className="field readonly-value">{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
          <div className="field-card" style={{ '--cat': '#6366f1' } as React.CSSProperties}>
            <label className="field-label flex items-center gap-1.5">
              <Wallet size={13} />
              {t('rojmel.cash_on_hand', 'Cash on Hand')} (₹)
            </label>
            <div className="field readonly-value" style={{ color: 'var(--tint-total-text)' }}>
              {cashOnHand.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="card category-card overflow-hidden" style={{ '--cat': '#3b82f6' } as React.CSSProperties}>
          <div className="category-strip">
            <span className="category-title">
              <ShoppingCart size={16} />
              Daily sales
            </span>
            <div className="flex gap-2">
              <button onClick={() => setShowColEditor(true)} className="btn btn-cat btn-sm" style={{ borderWidth: 1, borderStyle: 'solid' }} title="Reorder columns">
                Edit table
              </button>
              <button onClick={openAddProduct} className="btn btn-cat btn-sm" style={{ borderWidth: 1, borderStyle: 'solid' }} title="Add a product">
                <Plus size={13} />
                Add product
              </button>
            </div>
          </div>
          {(() => {
            const colWidths: Record<string, string | number> = { rate: '10%', opp: '10%', clo: '10%', net: '9%', sales: '10%', net_sales: '9%', total: '12%' }
            const gridColMap: Record<string, number> = {}
            let gc = 0
            for (const k of salesColOrder) {
              if (k === 'opp' || k === 'clo' || k === 'sales') { gridColMap[k] = gc; gc++ }
            }
            const headCells: Record<string, React.ReactNode> = {
              rate: <th key="rate" className="col-locked-head num-center">{t('rojmel.rate', 'Rate')} (₹)<Lock className="col-lock-head-ico" size={11} /></th>,
              opp: <th key="opp" className="col-locked-head num-right" title="Opening pieces (morning count)">OPP.PIC<Lock className="col-lock-head-ico" size={11} /></th>,
              clo: <th key="clo" className="num-right" title="Closing pieces (= total sales)">CLO.PIC</th>,
              net: <th key="net" className="num-right" title="Net = opening − closing">NET.PIC</th>,
              sales: <th key="sales" className="col-editable-head num-right">{t('rojmel.qty', 'Sales')}</th>,
              net_sales: <th key="net_sales" className="num-right" title="Accumulated sales total">NET.SALES</th>,
              total: <th key="total" className="col-total-head">{t('rojmel.total', 'Total')}</th>,
            }
            function bodyCells(s: SalesLine, i: number): Record<string, React.ReactNode> {
              const net = lines[i]?.net_pic ?? 0
              return {
                rate: <td key="rate" className="col-locked num-center">{s.rate || 0}</td>,
                opp: <td key="opp" className="col-stock">
                  {stockUnlocked ? (
                    <NumberField className="field-inline" value={s.opening_pic} onChange={(v) => updateSalesLine(i, { opening_pic: v })} ariaLabel="Opening pieces" entryFlow="opp" gridRow={i} gridCol={gridColMap.opp} gridTable="sales" />
                  ) : (
                    <button className="stock-locked" onClick={unlockStock} title="Click to edit opening (password needed)" data-grid-row={i} data-grid-col={gridColMap.opp} data-grid-table="sales" data-grid-locked>
                      {s.opening_pic || 0}
                    </button>
                  )}
                </td>,
                clo: <td key="clo" className="col-total">{lines[i]?.closing_pic ?? 0}</td>,
                net: <td key="net" className="col-total" style={{ color: net < 0 ? 'var(--net-neg)' : 'var(--net-pos)', fontWeight: 700 }}>{net}</td>,
                sales: <td key="sales" className="col-editable">
                  <NumberField className="field-inline num-right" value={tallyInputs[i] ?? 0} onChange={(v) => updateTally(i, v)} onKeyDown={(e) => handleTallyEnter(i, e)} ariaLabel="Sales pieces" entryFlow gridRow={i} gridCol={gridColMap.sales} gridTable="sales" />
                </td>,
                net_sales: <td key="net_sales" className="col-total" style={{ fontWeight: 700 }}>{s.qty || 0}</td>,
                total: <td key="total" className="col-total">₹{lines[i]?.total.toFixed(2)}</td>,
              }
            }
            return (
            <table className="data-table entry-table">
              <colgroup>
                <col />
                {salesColOrder.map((k) => <col key={k} style={{ width: colWidths[k] }} />)}
                <col style={{ width: 72 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{t('rojmel.product', 'Product')}</th>
                  {salesColOrder.map((k) => headCells[k])}
                  <th />
                </tr>
              </thead>
              <tbody>
                {salesLines.map((s, i) => {
                  const cells = bodyCells(s, i)
                  return (
                    <tr key={i} className="reveal-row">
                      <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.product || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      {salesColOrder.map((k) => cells[k])}
                      <td className="col-actions">
                        <button onClick={() => openEditProduct(i)} className="icon-btn reveal-target" aria-label="Edit product" title="Edit name / rate (password)">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => requestRemoveSales(i)} className="icon-btn icon-btn-danger reveal-target" aria-label="Remove product" title="Remove (password)">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {salesLines.length > 0 && (
                  <tr className="subtotal-row">
                    <td colSpan={salesColOrder.length + 1}>{t('rojmel.factory_sales', 'Factory Sales')}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{factorySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )
          })()}
        </div>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row">
          <MoneyLinesEditor
            title={t('rojmel.income', 'Income')}
            color="#10b981"
            icon={TrendingUp}
            flow="income-amt"
            gridTable="income"
            lines={incomeLines}
            onChange={setIncomeLines}
          />
          <MoneyLinesEditor
            title={t('rojmel.expense', 'Kharcho')}
            color="#ef4444"
            icon={TrendingDown}
            flow="kharcho-amt"
            gridTable="kharcho"
            lines={expenseLines}
            onChange={setExpenseLines}
          />
        </div>

        {/* Carry Forward (left) + Notes (right) share a row — same order as the
            printed sheet, and neither needs a full width to itself. */}
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        {/* Carry-forward: informational (not in any total), like the block below the
            totals in the Excel. Name is free-edit; the amount is admin-locked. */}
        <div className="card category-card flex-1 overflow-hidden" style={{ '--cat': '#8b5cf6' } as React.CSSProperties}>
          <div className="category-strip">
            <span className="category-title">
              <HandCoins size={16} />
              Carry Forward
            </span>
            <button
              onClick={addCarry}
              className="btn btn-cat btn-sm"
              style={{ borderWidth: 1, borderStyle: 'solid' }}
              title="Add a name"
            >
              <Plus size={13} />
              Add
            </button>
          </div>
          {/* Amount first here too, so every table on the sheet reads the same
              way (and matches the printed sheet). */}
          <table className="data-table entry-table money-table">
            <colgroup>
              <col style={{ width: 40 }} />
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center', padding: '6px 4px' }} title="Check to carry forward to the next day">↻</th>
                <th className="col-amt col-locked-head amt-cell">
                  Amount (₹)
                  <Lock className="col-lock-head-ico" size={11} />
                </th>
                <th>Name</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carryForward.map((c, i) => {
                const started = c.name.trim() !== '' || c.amount !== 0
                return (
                  <tr key={i} className="reveal-row">
                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                      <input
                        type="checkbox"
                        checked={c.carry_forward}
                        onChange={(e) => updateCarry(i, { carry_forward: e.target.checked })}
                        title="Carry this row to the next day"
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#8b5cf6' }}
                      />
                    </td>
                    <td className={`col-amt${started && c.amount === 0 ? ' is-missing' : ''}`}>
                      <button className="stock-locked" onClick={() => openCarryAmount(i)} title="Click to edit (password needed)" data-grid-row={i} data-grid-col={0} data-grid-table="carry" data-grid-locked>
                        {c.amount || 0}
                      </button>
                    </td>
                    <td className={`cell-edit${started && !c.name.trim() ? ' is-missing' : ''}`}>
                      <input
                        className="field-inline"
                        value={c.name}
                        onChange={(e) => updateCarry(i, { name: e.target.value })}
                        placeholder={i === 0 ? 'Name' : ''}
                        data-grid-row={i}
                        data-grid-col={1}
                        data-grid-table="carry"
                      />
                    </td>
                    <td className="col-actions">
                      <button onClick={() => removeCarry(i)} className="icon-btn icon-btn-danger reveal-target" aria-label="Remove" title="Remove (password)">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {carryForward.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '14px', fontSize: 12 }}>
                    None yet
                  </td>
                </tr>
              )}
              {carryForward.length > 0 && (
                <tr className="subtotal-row">
                  <td />
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ₹{carryForwardTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>{t('rojmel.total', 'Total')}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

          <div className="flex-1">
            <NotesGrid value={notes || null} onChange={updateNotes} className="" />
          </div>
        </div>

        {guard.dialog}

        {editing && (
          <ProductEditDialog
            product={salesLines[editing.index]}
            isNewRow={editing.isNew}
            onSave={(patch, mode) => applyProductEdit(editing.index, patch, mode)}
            onCancel={() => {
              if (editing.isNew && !salesLines[editing.index]?.product) {
                setSalesLines((rows) => rows.filter((_, i) => i !== editing.index))
              }
              setEditing(null)
            }}
          />
        )}

        {cfEdit !== null && (
          <FieldEditDialog
            title="Carry forward amount"
            label="Amount (₹)"
            value={carryForward[cfEdit]?.amount ?? 0}
            onSave={(value) => {
              updateCarry(cfEdit, { amount: value })
              closeCarryAmount()
            }}
            onCancel={closeCarryAmount}
          />
        )}

        <ConfirmDialog
          open={confirmDelete}
          title="Delete day?"
          message={`The entry from ${date} will be permanently removed.`}
          onConfirm={() => {
            setConfirmDelete(false)
            deleteMutation.mutate()
          }}
          onCancel={() => setConfirmDelete(false)}
        />

        <ConfirmDialog
          open={pendingRemoveSales !== null}
          title="Remove product?"
          message={
            pendingRemoveSales !== null && salesLines[pendingRemoveSales]?.product
              ? `"${salesLines[pendingRemoveSales].product}" will be removed from this day.`
              : 'This row will be removed from this day.'
          }
          confirmLabel="Remove"
          onConfirm={() => {
            if (pendingRemoveSales !== null) setSalesLines((rows) => rows.filter((_, idx) => idx !== pendingRemoveSales))
            setPendingRemoveSales(null)
          }}
          onCancel={() => setPendingRemoveSales(null)}
        />
      </div>

      <RojmelPrintSheet
        date={date}
        lines={lines}
        factorySales={factorySales}
        incomeLines={incomeLines}
        expenseLines={expenseLines}
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        cashOnHand={cashOnHand}
        notes={notes || null}
        carryForward={carryForward}
      />
      {showColEditor && (
        <ColumnOrderEditor
          columns={SALES_COL_DEFS}
          order={salesColOrder}
          onSave={saveSalesColOrder}
          onClose={() => setShowColEditor(false)}
        />
      )}
    </>
  )
}
