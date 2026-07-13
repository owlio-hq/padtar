import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { shakkarparaApi } from './api'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { MetricCards, type Metric } from '../../components/MetricCards'
import { ExportMenu } from '../../components/ExportMenu'
import { RowMenu } from '../../components/RowMenu'
import { ConfirmDialog } from '../../components/ConfirmDialog'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function BatchListPage() {
  const { t } = useLabels()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; date: string } | null>(null)

  const { data: batches, isLoading } = useQuery({
    queryKey: ['shakkarpara-batches', year, month],
    queryFn: () => shakkarparaApi.list({ year, month }),
  })

  // Populate year dropdown from ALL batches so picking one year never removes the others.
  const { data: allBatches } = useQuery({
    queryKey: ['shakkarpara-batches', 'all-years'],
    queryFn: () => shakkarparaApi.list({}),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shakkarparaApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shakkarpara-batches'] }),
  })

  const years = Array.from(new Set((allBatches ?? []).map((b) => new Date(b.date).getFullYear()))).sort((a, b) => b - a)

  const rows = batches ?? []

  // When a date has more than one batch, number them "Batch 1, 2 …" (creation order = id asc).
  const byDate = new Map<string, number[]>()
  for (const b of [...rows].sort((a, b) => a.id - b.id)) {
    byDate.set(b.date, [...(byDate.get(b.date) ?? []), b.id])
  }
  const batchLabel = (b: { id: number; date: string }): string | null => {
    const ids = byDate.get(b.date) ?? []
    return ids.length > 1 ? `Batch ${ids.indexOf(b.id) + 1}` : null
  }

  const padtars = rows.map((b) => b.padtar).filter((p): p is number => p !== null)
  const avgPadtar = padtars.length ? padtars.reduce((a, b) => a + b, 0) / padtars.length : null
  const totalCost = rows.reduce((a, b) => a + b.total, 0)
  const metrics: Metric[] = [
    { label: 'Batches', value: String(rows.length) },
    { label: 'Avg padtar', value: avgPadtar !== null ? `₹${avgPadtar.toFixed(2)}` : '—', accent: true },
    { label: 'Total cost', value: `₹${totalCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
  ]

  return (
    <div>
      <PageHeader
        title={t('shakkarpara.title', 'Shakkarpara')}
        subtitle="Batch costing"
        actions={
          <>
            <ExportMenu
              basePath="/api/shakkarpara/batches/export"
              currentYear={year}
              currentMonth={month}
              availableYears={years}
            />
            <Link to="/shakkarpara/new" className="btn btn-primary">
              <Plus size={14} />
              New batch
            </Link>
          </>
        }
      />

      <MetricCards metrics={metrics} />

      <div className="mb-3 flex gap-2">
        <select className="field w-auto" value={month ?? ''} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select className="field w-auto" value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table row-hover">
          <thead>
            <tr>
              <th>{t('shakkarpara.date', 'Date')}</th>
              <th>{t('shakkarpara.production', 'Production')}</th>
              <th style={{ textAlign: 'right' }}>{t('shakkarpara.total', 'Total')}</th>
              <th style={{ textAlign: 'right' }}>{t('shakkarpara.padtar', 'Padtar')}</th>
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>
                  No batches yet. Create your first one.
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="row-clickable" onClick={() => navigate(`/shakkarpara/${b.id}`)}>
                <td style={{ fontWeight: 500 }}>
                  {b.date}
                  {batchLabel(b) && (
                    <span
                      className="ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium"
                      style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
                    >
                      {batchLabel(b)}
                    </span>
                  )}
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {b.production_qty} {b.production_unit}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>₹{b.total.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>
                  {b.padtar !== null ? <span className="pill pill-accent">₹{b.padtar.toFixed(2)}</span> : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <RowMenu
                    items={[
                      { label: 'Open', icon: <Pencil size={15} />, onClick: () => navigate(`/shakkarpara/${b.id}`) },
                      { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => setPendingDelete({ id: b.id, date: b.date }) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete batch?"
        message={pendingDelete ? `The batch from ${pendingDelete.date} will be permanently removed.` : ''}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
