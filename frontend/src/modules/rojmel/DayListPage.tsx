import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Package, Pencil, Trash2 } from 'lucide-react'
import { rojmelApi } from './api'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { MetricCards, type Metric } from '../../components/MetricCards'
import { ExportMenu } from '../../components/ExportMenu'
import { RowMenu } from '../../components/RowMenu'
import { ConfirmDialog } from '../../components/ConfirmDialog'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function DayListPage() {
  const { t } = useLabels()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [year, setYear] = useState<number | undefined>(undefined)
  const [month, setMonth] = useState<number | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<{ id: number; date: string } | null>(null)

  const { data: days, isLoading } = useQuery({
    queryKey: ['rojmel-days', year, month],
    queryFn: () => rojmelApi.list({ year, month }),
  })

  // Populate year dropdown from ALL days so picking one year never removes the others.
  const { data: allDays } = useQuery({
    queryKey: ['rojmel-days', 'all-years'],
    queryFn: () => rojmelApi.list({}),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rojmelApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rojmel-days'] }),
  })

  const years = Array.from(new Set((allDays ?? []).map((d) => new Date(d.date).getFullYear()))).sort((a, b) => b - a)

  const rows = days ?? []
  const totalSales = rows.reduce((a, d) => a + d.factory_sales, 0)
  const totalCash = rows.reduce((a, d) => a + d.cash_on_hand, 0)
  const metrics: Metric[] = [
    { label: 'Days recorded', value: String(rows.length) },
    { label: 'Factory sales', value: `₹${totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
    { label: 'Cash on hand', value: `₹${totalCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, accent: true },
  ]

  return (
    <div>
      <PageHeader
        title={t('rojmel.title', 'Rojmel')}
        subtitle="Daily sales and cash"
        actions={
          <>
            <ExportMenu
              basePath="/api/rojmel/days/export"
              currentYear={year}
              currentMonth={month}
              availableYears={years}
            />
            <Link to="/rojmel/stock" className="btn btn-outline">
              <Package size={14} />
              Stock
            </Link>
            <Link to="/rojmel/new" className="btn btn-primary">
              <Plus size={14} />
              New day
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
              <th>{t('rojmel.date', 'Date')}</th>
              <th style={{ textAlign: 'right' }}>{t('rojmel.factory_sales', 'Factory Sales')}</th>
              <th style={{ textAlign: 'right' }}>{t('rojmel.expense', 'Expense')}</th>
              <th style={{ textAlign: 'right' }}>{t('rojmel.cash_on_hand', 'Cash on Hand')}</th>
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
                  No days recorded yet. Add your first one.
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} className="row-clickable" onClick={() => navigate(`/rojmel/${d.id}`)}>
                <td style={{ fontWeight: 500 }}>{d.date}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>₹{d.factory_sales.toFixed(2)}</td>
                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>₹{d.total_expense.toFixed(2)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span className="pill pill-accent">₹{d.cash_on_hand.toFixed(2)}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <RowMenu
                    items={[
                      { label: 'Open', icon: <Pencil size={15} />, onClick: () => navigate(`/rojmel/${d.id}`) },
                      { label: 'Delete', icon: <Trash2 size={15} />, danger: true, onClick: () => setPendingDelete({ id: d.id, date: d.date }) },
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
        title="Delete day?"
        message={pendingDelete ? `The entry from ${pendingDelete.date} will be permanently removed.` : ''}
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
