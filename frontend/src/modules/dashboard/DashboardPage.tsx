import { useMemo, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, ArrowRight } from 'lucide-react'
import { shakkarparaApi } from '../shakkarpara/api'
import { CATEGORY_ORDER } from '../shakkarpara/types'
import { rojmelApi } from '../rojmel/api'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { MetricCards, type Metric } from '../../components/MetricCards'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function inr2(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type YearKey = number | 'all'
type MonthKey = number | 'all'

export function DashboardPage() {
  const { t } = useLabels()

  const { data: allBatches } = useQuery({
    queryKey: ['shakkarpara-batches', 'dash-all'],
    queryFn: () => shakkarparaApi.list({}),
  })
  const { data: allDays } = useQuery({
    queryKey: ['rojmel-days', 'dash-all'],
    queryFn: () => rojmelApi.list({}),
  })

  const batches = allBatches ?? []
  const days = allDays ?? []

  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1

  const [year, setYear] = useState<YearKey>(curYear)
  const [month, setMonth] = useState<MonthKey>(curMonth)
  const [initialized, setInitialized] = useState(false)
  const [tab, setTab] = useState<'rojmed' | 'shakkarpara'>('rojmed')

  useEffect(() => {
    if (initialized) return
    if (!allBatches || !allDays) return
    setInitialized(true)
    const currentHasData =
      batches.some((b) => {
        const d = new Date(b.date)
        return d.getFullYear() === curYear && d.getMonth() + 1 === curMonth
      }) ||
      days.some((d) => {
        const dt = new Date(d.date)
        return dt.getFullYear() === curYear && dt.getMonth() + 1 === curMonth
      })
    if (currentHasData) return
    const dates = [...batches.map((b) => b.date), ...days.map((d) => d.date)].sort().reverse()
    if (dates.length) {
      const latest = new Date(dates[0])
      setYear(latest.getFullYear())
      setMonth(latest.getMonth() + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBatches, allDays])

  const years = useMemo(() => {
    const s = new Set<number>()
    batches.forEach((b) => s.add(new Date(b.date).getFullYear()))
    days.forEach((d) => s.add(new Date(d.date).getFullYear()))
    return Array.from(s).sort((a, b) => b - a)
  }, [batches, days])

  const matches = (dateStr: string): boolean => {
    const dt = new Date(dateStr)
    if (year !== 'all' && dt.getFullYear() !== year) return false
    if (month !== 'all' && dt.getMonth() + 1 !== month) return false
    return true
  }

  const scopedBatches = batches.filter((b) => matches(b.date))
  const scopedDays = days.filter((d) => matches(d.date))

  // ---- Rojmel Metrics ----
  const totalSales = scopedDays.reduce((a, d) => a + d.factory_sales, 0)
  const totalIncome = scopedDays.reduce((a, d) => a + d.total_income, 0)
  const totalExpense = scopedDays.reduce((a, d) => a + d.total_expense, 0)
  const netProfit = totalIncome - totalExpense
  const latestCash = scopedDays.length
    ? [...scopedDays].sort((a, b) => b.date.localeCompare(a.date))[0].cash_on_hand
    : null

  const rojmelMetrics: Metric[] = [
    { label: 'Days recorded', value: String(scopedDays.length) },
    { label: 'Factory sales', value: inr(totalSales) },
    { label: 'Total income', value: inr(totalIncome) },
    { label: 'Expense', value: inr(totalExpense) },
    { label: 'Cash on hand', value: latestCash !== null ? inr(latestCash) : '—', accent: true },
  ]

  // ---- Shakkarpara Metrics ----
  const padtars = scopedBatches.map((b) => b.padtar).filter((p): p is number => p !== null)
  const avgPadtar = padtars.length ? padtars.reduce((a, b) => a + b, 0) / padtars.length : null
  const minPadtar = padtars.length ? Math.min(...padtars) : null
  const maxPadtar = padtars.length ? Math.max(...padtars) : null
  const totalCost = scopedBatches.reduce((a, b) => a + b.total, 0)
  const totalProduction = scopedBatches.reduce((a, b) => a + b.production_qty, 0)

  const shakMetrics: Metric[] = [
    { label: 'Batches', value: String(scopedBatches.length) },
    { label: 'Avg padtar', value: avgPadtar !== null ? `₹${avgPadtar.toFixed(2)}` : '—', accent: true },
    { label: 'Total cost', value: inr(totalCost) },
    { label: 'Production (kg)', value: totalProduction.toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
  ]

  // ---- Cost by category ----
  const catTotals = new Map<string, number>()
  for (const b of scopedBatches) {
    for (const ing of b.ingredients ?? []) {
      catTotals.set(ing.category ?? 'Raw Material', (catTotals.get(ing.category ?? 'Raw Material') ?? 0) + ing.total)
    }
  }
  const catSlices = CATEGORY_ORDER.map((c) => ({ label: c, value: catTotals.get(c) ?? 0 })).filter((s) => s.value > 0)

  // ---- Recent activity ----
  const recentBatches = [...scopedBatches].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const recentDays = [...scopedDays].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const batchIdsByDate = new Map<string, number[]>()
  for (const b of [...scopedBatches].sort((a, b) => a.id - b.id)) {
    batchIdsByDate.set(b.date, [...(batchIdsByDate.get(b.date) ?? []), b.id])
  }
  const batchLabel = (b: { id: number; date: string }): string | null => {
    const ids = batchIdsByDate.get(b.date) ?? []
    return ids.length > 1 ? `Batch ${ids.indexOf(b.id) + 1}` : null
  }

  // ---- Trends ----
  const trendAnchor: { y: number; m: number } =
    year !== 'all' && month !== 'all'
      ? { y: year as number, m: month as number }
      : { y: curYear, m: curMonth }

  const trendMonths: { y: number; m: number; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(trendAnchor.y, trendAnchor.m - 1 - i, 1)
    trendMonths.push({ y: dt.getFullYear(), m: dt.getMonth() + 1, label: MONTH_SHORT[dt.getMonth()] })
  }

  const padtarTrend = trendMonths.map((tm) => {
    const inMonth = batches.filter((b) => {
      const dt = new Date(b.date)
      return dt.getFullYear() === tm.y && dt.getMonth() + 1 === tm.m && b.padtar !== null
    })
    if (!inMonth.length) return { ...tm, v: null as number | null }
    const avg = inMonth.reduce((a, b) => a + (b.padtar ?? 0), 0) / inMonth.length
    return { ...tm, v: avg }
  })

  const salesTrend = trendMonths.map((tm) => {
    const inMonth = days.filter((d) => {
      const dt = new Date(d.date)
      return dt.getFullYear() === tm.y && dt.getMonth() + 1 === tm.m
    })
    return { ...tm, v: inMonth.reduce((a, d) => a + d.factory_sales, 0) }
  })

  const incomeExpenseTrend = trendMonths.map((tm) => {
    const inMonth = days.filter((d) => {
      const dt = new Date(d.date)
      return dt.getFullYear() === tm.y && dt.getMonth() + 1 === tm.m
    })
    return {
      ...tm,
      income: inMonth.reduce((a, d) => a + d.total_income, 0),
      expense: inMonth.reduce((a, d) => a + d.total_expense, 0),
    }
  })

  const productionTrend = trendMonths.map((tm) => {
    const inMonth = batches.filter((b) => {
      const dt = new Date(b.date)
      return dt.getFullYear() === tm.y && dt.getMonth() + 1 === tm.m
    })
    return { ...tm, v: inMonth.reduce((a, b) => a + b.production_qty, 0) }
  })

  const periodLabel =
    year === 'all' && month === 'all'
      ? 'All time'
      : year === 'all'
      ? `${MONTH_NAMES[(month as number) - 1]} — All years`
      : month === 'all'
      ? `All months — ${year}`
      : `${MONTH_NAMES[(month as number) - 1]} ${year}`

  return (
    <div>
      <PageHeader title={t('nav.dashboard', 'Dashboard')} subtitle={periodLabel} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Viewing
        </span>
        <select
          className="field w-auto"
          value={month === 'all' ? 'all' : String(month)}
          onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All months</option>
          {MONTH_SHORT.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="field w-auto"
          value={year === 'all' ? 'all' : String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <span className="text-sm font-medium" style={{ color: 'var(--text)', marginLeft: 8 }}>
          {periodLabel}
        </span>
      </div>

      <div className="mb-4 flex gap-1" style={{ borderBottom: '2px solid var(--border)' }}>
        {(['rojmed', 'shakkarpara'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium"
            style={{
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent, #10b981)' : '2px solid transparent',
              marginBottom: -2,
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {t === 'rojmed' ? 'Rojmed' : 'Shakkarpara'}
          </button>
        ))}
      </div>

      {tab === 'rojmed' && (
        <>
          <MetricCards metrics={rojmelMetrics} />

          {/* Net profit/loss banner */}
          {scopedDays.length > 0 && (
            <div
              className="mb-4 card px-4 py-3 flex items-center justify-between"
              style={{ borderLeft: `3px solid ${netProfit >= 0 ? 'var(--tint-padtar-text, #10b981)' : 'var(--tint-negative-text, #dc2626)'}` }}
            >
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Net {netProfit >= 0 ? 'surplus' : 'deficit'} (Income − Expense)
              </span>
              <span
                className="text-sm font-semibold"
                style={{ color: netProfit >= 0 ? 'var(--tint-padtar-text, #10b981)' : 'var(--tint-negative-text, #dc2626)' }}
              >
                {netProfit >= 0 ? '+' : ''}{inr2(netProfit)}
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TrendCard title="Factory sales — last 6 months" data={salesTrend} formatter={inr} color="var(--tint-padtar-bg, #34d399)" />
            <DualTrendCard title="Income vs Expense — last 6 months" data={incomeExpenseTrend} />
          </div>

          <div className="mt-4 card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Recent days
              </h3>
              <Link to="/rojmel" className="back-link" style={{ margin: 0 }}>
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentDays.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No days in {periodLabel}.
              </div>
            ) : (
              recentDays.map((d) => (
                <Link
                  key={d.id}
                  to={`/rojmel/${d.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm day-row-hover"
                  style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <span className="flex items-center gap-3">
                    <span style={{ fontWeight: 500 }}>{d.date}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Sales: {inr(d.factory_sales)}
                    </span>
                  </span>
                  <span className="pill pill-accent">{inr(d.cash_on_hand)}</span>
                </Link>
              ))
            )}
          </div>

          <div className="mt-4">
            <Link to="/rojmel/new" className="btn btn-outline">
              <Plus size={14} />
              New day
            </Link>
          </div>
        </>
      )}

      {tab === 'shakkarpara' && (
        <>
          <MetricCards metrics={shakMetrics} />

          {/* Padtar range indicator */}
          {padtars.length > 1 && (
            <div className="mb-4 card px-4 py-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Padtar range
              </span>
              <span className="text-sm flex gap-4">
                <span style={{ color: 'var(--tint-padtar-text, #10b981)' }}>
                  Low: ₹{minPadtar!.toFixed(2)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--tint-negative-text, #dc2626)' }}>
                  High: ₹{maxPadtar!.toFixed(2)}
                </span>
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <TrendCard title="Padtar — last 6 months" data={padtarTrend} formatter={(v) => `₹${v.toFixed(2)}`} color="#8b5cf6" />
            <TrendCard title="Production — last 6 months" data={productionTrend} formatter={(v) => `${v.toLocaleString('en-IN')} kg`} color="#3b82f6" />
          </div>

          <div className="mt-4">
            <CostBreakdown slices={catSlices} />
          </div>

          <div className="mt-4 card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                Recent batches
              </h3>
              <Link to="/shakkarpara" className="back-link" style={{ margin: 0 }}>
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {recentBatches.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No batches in {periodLabel}.
              </div>
            ) : (
              recentBatches.map((b) => (
                <Link
                  key={b.id}
                  to={`/shakkarpara/${b.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm day-row-hover"
                  style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}
                >
                  <span className="flex items-center gap-3">
                    <span style={{ fontWeight: 500 }}>
                      {b.date}
                      {batchLabel(b) && (
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          · {batchLabel(b)}
                        </span>
                      )}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Cost: {inr(b.total)} · {b.production_qty} kg
                    </span>
                  </span>
                  <span className="pill pill-accent">{b.padtar !== null ? `₹${b.padtar.toFixed(2)}` : '—'}</span>
                </Link>
              ))
            )}
          </div>

          <div className="mt-4">
            <Link to="/shakkarpara/new" className="btn btn-outline">
              <Plus size={14} />
              New batch
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ---- Chart components ----

interface TrendPoint {
  y: number
  m: number
  label: string
  v: number | null
}

function TrendCard({
  title,
  data,
  formatter,
  color = 'var(--tint-padtar-bg, #34d399)',
}: {
  title: string
  data: TrendPoint[]
  formatter: (v: number) => string
  color?: string
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const values = data.map((d) => d.v).filter((v): v is number => v !== null && v > 0)
  const max = values.length ? Math.max(...values) : 0
  const latest = [...data].reverse().find((d) => d.v !== null && d.v > 0)
  const prev = [...data].reverse().slice(1).find((d) => d.v !== null && d.v > 0)
  const delta = latest && prev && prev.v ? ((latest.v! - prev.v!) / prev.v!) * 100 : null
  const deltaColor =
    delta === null ? 'var(--text-muted)' : delta > 0 ? 'var(--tint-padtar-text)' : delta < 0 ? 'var(--tint-negative-text, #dc2626)' : 'var(--text-muted)'
  const deltaSign = delta === null ? '' : delta > 0 ? '+' : ''

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</h3>
        {delta !== null && (
          <span className="text-xs font-medium" style={{ color: deltaColor }}>
            {deltaSign}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 px-4 pb-4 pt-6" style={{ height: 140, position: 'relative' }}>
        {data.map((d, i) => {
          const h = d.v !== null && max > 0 ? Math.max(6, (d.v / max) * 90) : 3
          const empty = d.v === null || d.v === 0
          const isHovered = hovered === i
          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1"
              style={{ position: 'relative' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && !empty && (
                <div style={{
                  position: 'absolute',
                  bottom: h + 18,
                  background: 'var(--surface-2, #1e293b)',
                  color: 'var(--text)',
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  border: '1px solid var(--border)',
                  pointerEvents: 'none',
                }}>
                  {formatter(d.v!)}
                </div>
              )}
              <div
                style={{
                  width: '100%',
                  height: `${h}px`,
                  backgroundColor: empty ? 'var(--surface-2)' : color,
                  borderRadius: 3,
                  opacity: empty ? 0.4 : isHovered ? 1 : 0.8,
                  transition: 'all 0.15s',
                  transform: isHovered && !empty ? 'scaleY(1.05)' : 'scaleY(1)',
                  transformOrigin: 'bottom',
                  cursor: empty ? 'default' : 'pointer',
                }}
              />
              <span className="text-[10px]" style={{ color: isHovered ? 'var(--text)' : 'var(--text-muted)', fontWeight: isHovered ? 600 : 400 }}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="px-4 pb-3 flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Latest: {latest && latest.v !== null ? formatter(latest.v) : '—'}
        </span>
        {values.length > 1 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Avg: {formatter(values.reduce((a, b) => a + b, 0) / values.length)}
          </span>
        )}
      </div>
    </div>
  )
}

interface DualPoint {
  y: number
  m: number
  label: string
  income: number
  expense: number
}

function DualTrendCard({ title, data }: { title: string; data: DualPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const allValues = data.flatMap((d) => [d.income, d.expense]).filter((v) => v > 0)
  const max = allValues.length ? Math.max(...allValues) : 0

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</h3>
        <div className="flex gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
            Income
          </span>
          <span className="flex items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }} />
            Expense
          </span>
        </div>
      </div>
      <div className="flex items-end gap-2 px-4 pb-4 pt-6" style={{ height: 140, position: 'relative' }}>
        {data.map((d, i) => {
          const hIncome = d.income > 0 && max > 0 ? Math.max(6, (d.income / max) * 90) : 3
          const hExpense = d.expense > 0 && max > 0 ? Math.max(6, (d.expense / max) * 90) : 3
          const emptyIncome = d.income === 0
          const emptyExpense = d.expense === 0
          const isHovered = hovered === i
          return (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1"
              style={{ position: 'relative' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {isHovered && (!emptyIncome || !emptyExpense) && (
                <div style={{
                  position: 'absolute',
                  bottom: Math.max(hIncome, hExpense) + 18,
                  background: 'var(--surface-2, #1e293b)',
                  color: 'var(--text)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  border: '1px solid var(--border)',
                  pointerEvents: 'none',
                  lineHeight: 1.4,
                }}>
                  <div style={{ color: '#10b981' }}>In: {inr(d.income)}</div>
                  <div style={{ color: '#ef4444' }}>Out: {inr(d.expense)}</div>
                </div>
              )}
              <div className="flex gap-0.5 items-end" style={{ width: '100%', height: 90 }}>
                <div
                  style={{
                    flex: 1,
                    height: `${hIncome}px`,
                    backgroundColor: emptyIncome ? 'var(--surface-2)' : '#10b981',
                    borderRadius: '3px 0 0 3px',
                    opacity: emptyIncome ? 0.3 : isHovered ? 1 : 0.7,
                    transition: 'all 0.15s',
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    height: `${hExpense}px`,
                    backgroundColor: emptyExpense ? 'var(--surface-2)' : '#ef4444',
                    borderRadius: '0 3px 3px 0',
                    opacity: emptyExpense ? 0.3 : isHovered ? 1 : 0.7,
                    transition: 'all 0.15s',
                  }}
                />
              </div>
              <span className="text-[10px]" style={{ color: isHovered ? 'var(--text)' : 'var(--text-muted)', fontWeight: isHovered ? 600 : 400 }}>
                {d.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const CAT_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981']

function CostBreakdown({ slices }: { slices: { label: string; value: number }[] }) {
  const [hoveredSeg, setHoveredSeg] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  if (total <= 0) {
    return (
      <div className="card p-4">
        <h3 className="mb-1 text-sm font-medium" style={{ color: 'var(--text)' }}>
          Cost breakdown by category
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          No batch costs in this period yet.
        </p>
      </div>
    )
  }

  const R = 52
  const C = 2 * Math.PI * R
  let offset = 0
  const segs = slices.map((s, i) => {
    const frac = s.value / total
    const seg = { color: CAT_COLORS[i % CAT_COLORS.length], frac, offset, label: s.label, value: s.value }
    offset += frac
    return seg
  })

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
        Cost breakdown by category
      </h3>
      <div className="flex flex-wrap items-center gap-6">
        <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flexShrink: 0 }}>
          <g transform="rotate(-90 70 70)">
            {segs.map((seg, i) => (
              <circle
                key={i}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={seg.color}
                strokeWidth={hoveredSeg === i ? 24 : 20}
                strokeDasharray={`${seg.frac * C} ${C}`}
                strokeDashoffset={-seg.offset * C}
                style={{ transition: 'stroke-width 0.15s, opacity 0.15s', opacity: hoveredSeg !== null && hoveredSeg !== i ? 0.4 : 1, cursor: 'pointer' }}
                onMouseEnter={() => setHoveredSeg(i)}
                onMouseLeave={() => setHoveredSeg(null)}
              />
            ))}
          </g>
          {hoveredSeg !== null && (
            <text x="70" y="70" textAnchor="middle" dominantBaseline="central" fill="var(--text)" fontSize="13" fontWeight="700">
              {(segs[hoveredSeg].frac * 100).toFixed(0)}%
            </text>
          )}
        </svg>
        <div className="flex-1" style={{ minWidth: 180 }}>
          {segs.map((seg, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-1.5 px-2 rounded text-sm"
              style={{
                color: 'var(--text)',
                background: hoveredSeg === i ? 'var(--hover)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={() => setHoveredSeg(i)}
              onMouseLeave={() => setHoveredSeg(null)}
            >
              <span className="flex items-center gap-2">
                <span style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: seg.color, display: 'inline-block' }} />
                {seg.label}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {(seg.frac * 100).toFixed(0)}% · ₹{seg.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
