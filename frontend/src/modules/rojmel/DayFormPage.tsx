import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, FileSpreadsheet, FileText, Printer, Pencil, Lock,
  ShoppingCart, TrendingUp, TrendingDown, Calendar, type LucideIcon,
} from 'lucide-react'
import { rojmelApi } from './api'
import { computeDay } from './calc'
import type { DayInput, MoneyLine, SalesLine } from './types'
import { ProductEditDialog, type ApplyMode } from './ProductEditDialog'
import { useAuth } from '../../auth/AuthContext'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { NumberField } from '../../components/NumberField'
import { NotesGrid } from '../../components/NotesGrid'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function MoneyLinesEditor({
  title,
  color,
  icon: Icon,
  lines,
  onChange,
}: {
  title: string
  color: string
  icon: LucideIcon
  lines: MoneyLine[]
  onChange: (lines: MoneyLine[]) => void
}) {
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)

  function update(i: number, patch: Partial<MoneyLine>) {
    onChange(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function add() {
    onChange([...lines, { description: '', amount: 0, note: '' }])
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i))
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
        <table className="data-table entry-table">
          <colgroup>
            <col />
            <col style={{ width: '26%' }} />
            <col />
            <col style={{ width: 44 }} />
          </colgroup>
          <thead>
            <tr>
              <th>Description</th>
              <th className="col-editable-head" style={{ textAlign: 'right' }}>Amount (₹)</th>
              <th>Note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="reveal-row">
                <td className="cell-edit">
                  <input className="field-inline" value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="What for…" />
                </td>
                <td className="col-editable">
                  <NumberField className="field-inline" value={l.amount} onChange={(v) => update(i, { amount: v })} ariaLabel="Amount" />
                </td>
                <td className="cell-edit">
                  <input className="field-inline" value={l.note} onChange={(e) => update(i, { note: e.target.value })} placeholder="Note" />
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => setPendingRemove(i)} className="icon-btn icon-btn-danger reveal-target" aria-label="Remove line" title="Remove line">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '14px', fontSize: 12 }}>
                  None yet
                </td>
              </tr>
            )}
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
  const { requireEdit } = useAuth()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRemoveSales, setPendingRemoveSales] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null)

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
  const seeded = useRef(false)

  useEffect(() => {
    if (!isNew || seeded.current || !defaultProducts) return
    seeded.current = true
    setSalesLines(defaultProducts.map((p) => ({ product: p.name, rate: p.rate, qty: 0 })))
  }, [isNew, defaultProducts])

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setNotes(existing.notes ?? '')
    setSalesLines(existing.sales_lines)
    setIncomeLines(existing.income_lines)
    setExpenseLines(existing.expense_lines)
  }, [existing])

  const { lines, factorySales, totalIncome, totalExpense, cashOnHand } = computeDay(salesLines, incomeLines, expenseLines)

  const saveMutation = useMutation({
    mutationFn: (payload: DayInput) => (isNew ? rojmelApi.create(payload) : rojmelApi.update(dayId as number, payload)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['rojmel-days'] })
      queryClient.invalidateQueries({ queryKey: ['rojmel-day', saved.id] })
      queryClient.invalidateQueries({ queryKey: ['rojmel-history', saved.id] })
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

  function updateSalesLine(i: number, patch: Partial<SalesLine>) {
    setSalesLines((rows) => rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  // ---- password-gated structural actions ----
  async function openEditProduct(index: number) {
    if (await requireEdit()) setEditing({ index, isNew: false })
  }
  async function openAddProduct() {
    if (!(await requireEdit())) return
    setSalesLines((rows) => [...rows, { product: '', rate: 0, qty: 0 }])
    setEditing({ index: salesLines.length, isNew: true })
  }
  async function requestRemoveSales(index: number) {
    if (await requireEdit()) setPendingRemoveSales(index)
  }
  async function requestDeleteDay() {
    if (await requireEdit()) setConfirmDelete(true)
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

  function handleSave() {
    saveMutation.mutate({ date, notes: notes || null, sales_lines: salesLines, income_lines: incomeLines, expense_lines: expenseLines })
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 940 }}>
      <PageHeader
        title={isNew ? 'New day' : `Day — ${date}`}
        subtitle="Daily sales and cash"
        backTo="/rojmel"
        backLabel={t('rojmel.title', 'Rojmel')}
        actions={
          !isNew ? (
            <>
              <button className="btn btn-outline" onClick={() => window.print()} title="Print this day">
                <Printer size={14} />
                Print
              </button>
              <a href={`/api/rojmel/days/${dayId}/export/excel`} className="btn btn-outline" title="Export this day to Excel">
                <FileSpreadsheet size={14} style={{ color: 'var(--tint-total-text)' }} />
                Excel
              </a>
              <a href={`/api/rojmel/days/${dayId}/export/pdf`} className="btn btn-outline" title="Export this day to PDF">
                <FileText size={14} style={{ color: 'var(--tint-rate-text)' }} />
                PDF
              </a>
              <button className="btn btn-danger" onClick={requestDeleteDay}>
                <Trash2 size={14} />
                Delete
              </button>
            </>
          ) : undefined
        }
      />

      {saveMutation.isError && (
        <div
          className="mb-4 rounded px-3 py-2 text-sm"
          style={{ border: '1px solid var(--tint-negative-text)', color: 'var(--tint-negative-text)', backgroundColor: 'var(--tint-negative-bg)' }}
        >
          {(saveMutation.error as Error).message.includes('409')
            ? 'A Rojmel entry already exists for this date.'
            : 'Could not save — please try again.'}
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-3">
        <div className="field-card">
          <label className="field-label flex items-center gap-1.5">
            <Calendar size={13} />
            {t('rojmel.date', 'Date')}
          </label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="card category-card overflow-hidden" style={{ '--cat': '#3b82f6' } as React.CSSProperties}>
        <div className="category-strip">
          <span className="category-title">
            <ShoppingCart size={16} />
            Daily sales
          </span>
          <button onClick={openAddProduct} className="btn btn-cat btn-sm" style={{ borderWidth: 1, borderStyle: 'solid' }} title="Add a product">
            <Plus size={13} />
            Add product
          </button>
        </div>
        <table className="data-table entry-table">
          <colgroup>
            <col />
            <col style={{ width: '22%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: 76 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t('rojmel.product', 'Product')}</th>
              <th className="col-locked-head">
                {t('rojmel.rate', 'Rate')} (₹)
                <Lock className="col-lock-head-ico" size={11} />
              </th>
              <th className="col-editable-head">{t('rojmel.qty', 'Pic')}</th>
              <th className="col-total-head">{t('rojmel.total', 'Total')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {salesLines.map((s, i) => (
              <tr key={i} className="reveal-row">
                <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.product || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td className="col-locked">
                  {s.rate || 0}
                </td>
                <td className="col-editable">
                  <NumberField className="field-inline" value={s.qty} onChange={(v) => updateSalesLine(i, { qty: v })} ariaLabel="Pieces" />
                </td>
                <td className="col-total">₹{lines[i]?.total.toFixed(2)}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEditProduct(i)} className="icon-btn reveal-target" aria-label="Edit product" title="Edit name / rate (password)">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => requestRemoveSales(i)} className="icon-btn icon-btn-danger reveal-target" aria-label="Remove product" title="Remove (password)">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {salesLines.length > 0 && (
              <tr className="subtotal-row">
                <td colSpan={3}>{t('rojmel.factory_sales', 'Factory Sales')}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  ₹{factorySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row">
        <MoneyLinesEditor
          title={`${t('rojmel.income', 'Income')} (besides factory sales)`}
          color="#10b981"
          icon={TrendingUp}
          lines={incomeLines}
          onChange={setIncomeLines}
        />
        <MoneyLinesEditor
          title={t('rojmel.expense', 'Kharcho')}
          color="#ef4444"
          icon={TrendingDown}
          lines={expenseLines}
          onChange={setExpenseLines}
        />
      </div>

      <NotesGrid value={notes || null} onChange={(v) => setNotes(v ?? '')} />

      <div className="card mt-5 flex items-center justify-between p-4">
        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('rojmel.income', 'Income')}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>₹{totalIncome.toFixed(2)}</span> ·{' '}
          {t('rojmel.expense', 'Expense')}: <span style={{ color: 'var(--text)', fontWeight: 500 }}>₹{totalExpense.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('rojmel.cash_on_hand', 'Cash on Hand')}</span>
          <span className="pill pill-accent" style={{ fontSize: 15, padding: '5px 12px' }}>₹{cashOnHand.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button onClick={handleSave} disabled={saveMutation.isPending} className="btn btn-primary">
          {saveMutation.isPending ? 'Saving…' : 'Save day'}
        </button>
      </div>

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
  )
}
