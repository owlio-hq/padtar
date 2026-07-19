import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, FileSpreadsheet, FileText, Printer, Pencil, Lock, Save,
  Wheat, Flame, Fuel, Box, Users, Calendar, Factory, Receipt, Sigma, Coins, type LucideIcon,
} from 'lucide-react'
import { shakkarparaApi } from './api'
import { computeBatch } from './calc'
import { DEFAULT_OIL_SIT } from './defaults'
import { CATEGORY_ORDER, type BatchInput, type Ingredient, type OilSit } from './types'
import { IngredientEditDialog, type ApplyMode } from './IngredientEditDialog'
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Category accent colors — same palette as the Dashboard cost pie, so the app is consistent.
const CATEGORY_COLORS: Record<string, string> = {
  'Raw Material': '#3b82f6', // blue
  'Cooking/Frying': '#f59e0b', // amber
  Fuel: '#ef4444', // red
  Packaging: '#8b5cf6', // purple
  Worker: '#10b981', // green
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Raw Material': Wheat,
  'Cooking/Frying': Flame,
  Fuel: Fuel,
  Packaging: Box,
  Worker: Users,
}

export function BatchFormPage() {
  const { id } = useParams()
  const isNew = id === 'new' || id === undefined
  const batchId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useLabels()
  const { requireEdit, lockEdit } = useAuth()
  const topRowRef = useRef<HTMLDivElement>(null)
  const entryFlow = useEntryFlow<HTMLDivElement>()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ index: number; isNew: boolean } | null>(null)
  // Which locked top-row card is currently being edited in a popup (null = none).
  // The popup is the whole edit session: it opens right after the password and
  // closes on save/cancel, so these fields are never left sitting unlocked.
  const [fieldEdit, setFieldEdit] = useState<'prod' | 'extra' | null>(null)

  const { data: existing } = useQuery({
    queryKey: ['shakkarpara-batch', batchId],
    queryFn: () => shakkarparaApi.get(batchId as number),
    enabled: !isNew,
  })

  // Editable defaults (from DB) — seed a new batch's ingredient rows.
  const { data: defaultIngredients } = useQuery({
    queryKey: ['shakkarpara-default-ingredients'],
    queryFn: () => shakkarparaApi.getDefaults(),
  })

  const [date, setDate] = useState(todayIso())
  const [productionQty, setProductionQty] = useState(0)
  const [productionUnit, setProductionUnit] = useState('kg')
  const [extraPerUnit, setExtraPerUnit] = useState(0)
  const [notes, setNotes] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [oilSit, setOilSit] = useState<OilSit>(DEFAULT_OIL_SIT)
  const seeded = useRef(false)

  // Seed a brand-new batch from the editable defaults once they load.
  useEffect(() => {
    if (!isNew || seeded.current || !defaultIngredients) return
    seeded.current = true
    setIngredients(defaultIngredients.map((d) => ({ ...d })))
  }, [isNew, defaultIngredients])

  useEffect(() => {
    if (!existing) return
    setDate(existing.date)
    setProductionQty(existing.production_qty)
    setProductionUnit(existing.production_unit)
    setExtraPerUnit(existing.extra_per_unit ?? 0)
    setNotes(existing.notes ?? '')
    setIngredients(existing.ingredients)
    setOilSit(existing.oil_sit ?? DEFAULT_OIL_SIT)
  }, [existing])

  const { lines, total, padtar } = computeBatch(ingredients, oilSit, productionQty, extraPerUnit)

  // Latest values, reachable from the mutation callback below.
  const dirtyKeyRef = useRef('')
  const markSavedRef = useRef<(snapshot?: string) => void>(() => {})

  const saveMutation = useMutation({
    mutationFn: (payload: BatchInput) =>
      isNew ? shakkarparaApi.create(payload) : shakkarparaApi.update(batchId as number, payload),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-batches'] })
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-batch', saved.id] })
      markSavedRef.current(dirtyKeyRef.current) // sheet is clean again
      navigate(`/shakkarpara/${saved.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => shakkarparaApi.remove(batchId as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-batches'] })
      navigate('/shakkarpara')
    },
  })

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  // ---- password-gated structural actions ----
  async function openEdit(index: number) {
    if (await requireEdit()) setEditing({ index, isNew: false })
  }

  async function openAdd(category: string) {
    if (!(await requireEdit())) return
    setIngredients((rows) => [
      ...rows,
      { name: '', category, rate: 0, usage: 0, unit: '', is_oil_vaprayel: false },
    ])
    setEditing({ index: ingredients.length, isNew: true })
  }

  async function requestRemove(index: number) {
    if (await requireEdit()) setPendingRemove(index)
  }

  async function requestDeleteBatch() {
    if (await requireEdit()) setConfirmDelete(true)
  }

  // Password first, then the popup opens immediately with the value ready to type.
  async function openFieldEdit(which: 'prod' | 'extra') {
    if (!(await requireEdit())) return
    setFieldEdit(which)
  }

  // Close the popup and drop edit access, so the next change asks again.
  function closeFieldEdit() {
    setFieldEdit(null)
    lockEdit()
  }

  // Apply an ingredient edit; optionally push it to the defaults table.
  async function applyIngredientEdit(
    index: number,
    patch: Pick<Ingredient, 'name' | 'rate' | 'unit'>,
    mode: ApplyMode,
  ) {
    const oldName = ingredients[index]?.name
    const category = ingredients[index]?.category ?? 'Raw Material'
    const isOil = ingredients[index]?.is_oil_vaprayel ?? false
    updateIngredient(index, patch)

    // Oil Vaprayel is bought at the same rate as the Oil row, so mirror the new
    // rate into it. Only on an explicit edit — never on load, or opening an old
    // batch whose two oil rates differed would silently change its total.
    if (!isOil && category === 'Cooking/Frying') {
      setIngredients((rows) =>
        rows.map((row) => (row.is_oil_vaprayel && row.category === category ? { ...row, rate: patch.rate } : row)),
      )
    }

    if (mode === 'default') {
      const current = await shakkarparaApi.getDefaults()
      const next = current.map((d) => ({ ...d }))
      const match = next.find((d) => d.name === oldName && d.category === category)
      if (match) {
        match.name = patch.name
        match.rate = patch.rate
        match.unit = patch.unit
      } else {
        next.push({ name: patch.name, category, rate: patch.rate, usage: 0, unit: patch.unit, is_oil_vaprayel: isOil })
      }
      // keep the Oil Vaprayel default's rate tied to the Oil default's rate too
      if (!isOil && category === 'Cooking/Frying') {
        const autoOil = next.find((d) => d.is_oil_vaprayel && d.category === category)
        if (autoOil) autoOil.rate = patch.rate
      }
      await shakkarparaApi.setDefaults(next)
      queryClient.invalidateQueries({ queryKey: ['shakkarpara-default-ingredients'] })
    }
    setEditing(null)
  }

  function buildPayload(): BatchInput {
    return {
      date,
      production_qty: productionQty,
      production_unit: productionUnit,
      extra_per_unit: extraPerUnit,
      notes: notes || null,
      ingredients,
      oil_sit: oilSit,
    }
  }

  function handleSave() {
    saveMutation.mutate(buildPayload())
  }
  useSaveShortcut(handleSave, !saveMutation.isPending)

  async function exportFile(kind: 'excel' | 'pdf') {
    const ext = kind === 'excel' ? 'xlsx' : 'pdf'
    await saveExport(`/api/shakkarpara/batches/${batchId}/export/${kind}`, `shakkarpara_${date}_${batchId}.${ext}`)
  }

  // What the worker actually typed — server-added fields (id, total) are left
  // out, otherwise a refetch after saving would look like a fresh edit.
  const dirtyKey = JSON.stringify({
    date,
    productionQty,
    productionUnit,
    extraPerUnit,
    notes,
    oilSit,
    ingredients: ingredients.map((i) => [i.name, i.category, i.rate, i.usage, i.unit, i.is_oil_vaprayel]),
  })
  dirtyKeyRef.current = dirtyKey

  // Guard the sheet: leaving (or an app update) must not silently drop edits.
  const guard = useUnsavedGuard({
    payload: dirtyKey,
    ready: isNew ? ingredients.length > 0 : !!existing,
    save: async () => {
      await saveMutation.mutateAsync(buildPayload())
    },
  })
  markSavedRef.current = guard.markSaved

  const oilSitNet = oilSit.nava_dabba + oilSit.juna_dabba + oilSit.toppa - oilSit.parat_malela

  // group ingredient indices by category, preserving array order
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    rows: ingredients.map((ing, idx) => ({ ing, idx })).filter((x) => x.ing.category === cat),
  }))
  const catSubtotal = (rows: { idx: number }[]) => rows.reduce((s, r) => s + (lines[r.idx]?.total ?? 0), 0)

  return (
    <div className="mx-auto" style={{ maxWidth: 940 }} ref={entryFlow.containerRef} onKeyDown={entryFlow.onKeyDown}>
      <PageHeader
        title={isNew ? 'New batch' : `Batch – ${date}`}
        subtitle="Batch costing"
        backTo="/shakkarpara"
        backLabel={t('shakkarpara.title', 'Shakkarpara')}
        actions={
          <>
            <button className="btn btn-primary" onClick={handleSave} disabled={saveMutation.isPending} title="Save (Ctrl+S)">
              <Save size={14} />
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
            {!isNew && (
            <>
              <button className="btn btn-outline" onClick={() => window.print()} title="Print this batch">
                <Printer size={14} />
                Print
              </button>
              <button className="btn btn-outline" onClick={() => exportFile('excel')} title="Export this batch to Excel">
                <FileSpreadsheet size={14} style={{ color: 'var(--tint-total-text)' }} />
                Excel
              </button>
              <button className="btn btn-outline" onClick={() => exportFile('pdf')} title="Export this batch to PDF">
                <FileText size={14} style={{ color: 'var(--tint-rate-text)' }} />
                PDF
              </button>
              <button className="btn btn-danger" onClick={requestDeleteBatch}>
                <Trash2 size={14} />
                Delete
              </button>
            </>
            )}
          </>
        }
      />

      {/* Five cards, coloured by meaning: date = info, production = quantity made,
          office expenses = a cost, grand total = the sum, padtar = the headline. */}
      <div className="mb-5 grid grid-cols-5 gap-3" ref={topRowRef}>
        <div className="field-card" style={{ '--cat': '#94a3b8' } as React.CSSProperties}>
          <label className="field-label flex items-center gap-1.5">
            <Calendar size={13} />
            {t('shakkarpara.date', 'Date')}
          </label>
          <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field-card" style={{ '--cat': '#3b82f6' } as React.CSSProperties}>
          <Lock size={12} className="field-card-lock" />
          <label className="field-label flex items-center gap-1.5">
            <Factory size={13} />
            {t('shakkarpara.production', 'Production')}
          </label>
          <button className="field locked-field" onClick={() => openFieldEdit('prod')} title="Click to edit (password needed)">
            {productionQty || 0} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{productionUnit}</span>
          </button>
        </div>

        <div className="field-card" style={{ '--cat': '#f59e0b' } as React.CSSProperties}>
          <Lock size={12} className="field-card-lock" />
          <label className="field-label flex items-center gap-1.5" title="Office / overhead added on top of cost-per-unit">
            <Receipt size={13} />
            Office Expenses (₹)
          </label>
          <button className="field locked-field" onClick={() => openFieldEdit('extra')} title="Click to edit (password needed)">
            {extraPerUnit || 0}
          </button>
        </div>

        <div className="field-card" style={{ '--cat': '#8b5cf6' } as React.CSSProperties}>
          <label className="field-label flex items-center gap-1.5">
            <Sigma size={13} />
            Grand Total (₹)
          </label>
          <div className="field readonly-value">
            {total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="field-card" style={{ '--cat': '#10b981' } as React.CSSProperties}>
          <label className="field-label flex items-center gap-1.5">
            <Coins size={13} />
            {t('shakkarpara.padtar', 'Padtar')} (₹)
          </label>
          <div className="field readonly-value" style={{ color: 'var(--tint-total-text)' }}>
            {padtar !== null ? padtar.toFixed(2) : '—'}
          </div>
        </div>
      </div>

      {byCategory.map(({ cat, rows }) => {
        const color = CATEGORY_COLORS[cat] ?? 'var(--accent)'
        const CatIcon = CATEGORY_ICONS[cat] ?? Box
        return (
        <div key={cat} className="card category-card mb-4" style={{ '--cat': color } as React.CSSProperties}>
          <div className="category-strip">
            <span className="category-title">
              <CatIcon size={16} />
              {cat}
            </span>
            <button className="btn btn-cat btn-sm" style={{ borderWidth: 1, borderStyle: 'solid' }} onClick={() => openAdd(cat)} title="Add an ingredient to this category">
              <Plus size={13} />
              Add
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
                <th>Ingredient</th>
                <th className="col-locked-head">
                  Rate / Unit
                  <Lock className="col-lock-head-ico" size={11} />
                </th>
                <th className="col-editable-head">{t('shakkarpara.usage', 'Vaprash')}</th>
                <th className="col-total-head">{t('shakkarpara.total', 'Total')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>
                    No items. Click “Add”.
                  </td>
                </tr>
              )}
              {rows.map(({ ing, idx }) => (
                // Oil Vaprayel is fully automatic: rate follows the Oil row, usage comes
                // from the Oil Sheet — so the whole row is read-only and tinted.
                <tr key={idx} className={ing.is_oil_vaprayel ? 'auto-row' : 'reveal-row'}>
                  <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ing.name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="col-locked">
                    {ing.rate || 0} / {ing.unit || '—'}
                  </td>
                  <td className="col-editable">
                    {ing.is_oil_vaprayel ? (
                      <span className="auto-box" title="Automatic — Net Vaprash from the Oil Sheet below">
                        {lines[idx]?.usage.toFixed(2)} (auto)
                      </span>
                    ) : (
                      <NumberField
                        min={0}
                        className="field-inline"
                        value={ing.usage}
                        onChange={(v) => updateIngredient(idx, { usage: v })}
                        ariaLabel="Vaprash"
                        entryFlow
                      />
                    )}
                  </td>
                  <td className="col-total">₹{lines[idx]?.total.toFixed(2)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!ing.is_oil_vaprayel && (
                      <>
                        <button className="icon-btn reveal-target" onClick={() => openEdit(idx)} aria-label="Edit ingredient" title="Edit rate / unit / name (password)">
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn icon-btn-danger reveal-target" onClick={() => requestRemove(idx)} aria-label="Remove ingredient" title="Remove (password)">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length > 0 && (
                <tr className="subtotal-row">
                  <td colSpan={3}>{cat} subtotal</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    ₹{catSubtotal(rows).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>

          {/* Oil Sheet sits inside the Cooking/Frying card (its net vaprash feeds Oil Vaprayel). */}
          {cat === 'Cooking/Frying' && (
            <div className="oil-sheet-box">
              <div className="mb-2 uppercase tracking-wide" title="Net Vaprash from this table is used automatically as the Oil Vaprayel usage above" style={{ cursor: 'help', display: 'inline-block' }}>
                <span className="oil-sheet-label">{t('shakkarpara.oil_sit', 'Oil Sheet')}</span>
              </div>
              <div className="grid grid-cols-5 gap-3">
                <div>
                  <label className="field-label">{t('shakkarpara.nava_dabba', 'Nava Dabba')}</label>
                  <NumberField min={0} value={oilSit.nava_dabba} onChange={(v) => setOilSit({ ...oilSit, nava_dabba: v })} />
                </div>
                <div>
                  <label className="field-label">{t('shakkarpara.juna_dabba', 'Juna Dabba')}</label>
                  <NumberField min={0} value={oilSit.juna_dabba} onChange={(v) => setOilSit({ ...oilSit, juna_dabba: v })} />
                </div>
                <div>
                  <label className="field-label">{t('shakkarpara.toppa', 'Toppa')}</label>
                  <NumberField min={0} value={oilSit.toppa} onChange={(v) => setOilSit({ ...oilSit, toppa: v })} />
                </div>
                <div>
                  <label className="field-label">{t('shakkarpara.parat_malela', 'Parat Malela')}</label>
                  <NumberField min={0} value={oilSit.parat_malela} onChange={(v) => setOilSit({ ...oilSit, parat_malela: v })} />
                </div>
                <div>
                  <label className="field-label">{t('shakkarpara.net_vaprash', 'Net Vaprash')}</label>
                  <div className="pill pill-accent" style={{ height: 32, borderRadius: 'var(--radius)', width: '100%', justifyContent: 'center', fontWeight: 600 }}>
                    {oilSitNet.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        )
      })}

      <NotesGrid value={notes || null} onChange={(v) => setNotes(v ?? '')} />

      <div className="mt-5 flex justify-end">
        <button onClick={handleSave} disabled={saveMutation.isPending} className="btn btn-primary">
          {saveMutation.isPending ? 'Saving…' : 'Save batch'}
        </button>
      </div>

      {guard.dialog}

      {editing && (
        <IngredientEditDialog
          ingredient={ingredients[editing.index]}
          isNewRow={editing.isNew}
          onSave={(patch, mode) => applyIngredientEdit(editing.index, patch, mode)}
          onCancel={() => {
            // if cancelling a freshly-added blank row, drop it
            if (editing.isNew && !ingredients[editing.index]?.name) {
              setIngredients((rows) => rows.filter((_, i) => i !== editing.index))
            }
            setEditing(null)
          }}
        />
      )}

      {fieldEdit === 'prod' && (
        <FieldEditDialog
          title="Edit production"
          label={t('shakkarpara.production', 'Production')}
          value={productionQty}
          unit={productionUnit}
          onSave={(v, u) => {
            setProductionQty(v)
            setProductionUnit(u?.trim() || 'kg')
            closeFieldEdit()
          }}
          onCancel={closeFieldEdit}
        />
      )}

      {fieldEdit === 'extra' && (
        <FieldEditDialog
          title="Edit office expenses"
          label="Office Expenses (₹)"
          value={extraPerUnit}
          onSave={(v) => {
            setExtraPerUnit(v)
            closeFieldEdit()
          }}
          onCancel={closeFieldEdit}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete batch?"
        message={`The batch from ${date} will be permanently removed.`}
        onConfirm={() => {
          setConfirmDelete(false)
          deleteMutation.mutate()
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove ingredient?"
        message={
          pendingRemove !== null && ingredients[pendingRemove]?.name
            ? `"${ingredients[pendingRemove].name}" will be removed from this batch.`
            : 'This row will be removed from this batch.'
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (pendingRemove !== null) setIngredients((rows) => rows.filter((_, i) => i !== pendingRemove))
          setPendingRemove(null)
        }}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}
