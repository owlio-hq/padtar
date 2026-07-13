import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { rojmelApi } from './api'
import type { StockRow } from './types'
import { useLabels } from '../../i18n/LabelsContext'
import { PageHeader } from '../../components/PageHeader'
import { ExportButtons } from '../../components/ExportButtons'
import { NumberField } from '../../components/NumberField'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function StockPage() {
  const { t } = useLabels()
  const queryClient = useQueryClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { data: rows, isLoading } = useQuery({
    queryKey: ['rojmel-stock', year, month],
    queryFn: () => rojmelApi.stock(year, month),
  })

  const [edited, setEdited] = useState<Record<number, number>>({})

  useEffect(() => {
    setEdited({})
  }, [year, month, rows])

  const updateMutation = useMutation({
    mutationFn: ({ id, opening_pic }: { id: number; opening_pic: number }) => rojmelApi.updateStock(id, { opening_pic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rojmel-stock', year, month] })
    },
  })

  function displayedOpening(row: StockRow): number {
    return edited[row.id] ?? row.opening_pic
  }
  function displayedNet(row: StockRow): number {
    return displayedOpening(row) - row.closing_pic
  }
  function commit(row: StockRow) {
    const value = edited[row.id]
    if (value === undefined || value === row.opening_pic) return
    updateMutation.mutate({ id: row.id, opening_pic: value })
  }

  return (
    <div>
      <PageHeader
        title={t('rojmel.stock', 'Stock')}
        subtitle="Monthly stock reconciliation"
        backTo="/rojmel"
        backLabel={t('rojmel.title', 'Rojmel')}
        actions={
          <>
            <select className="field w-auto" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select className="field w-auto" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <ExportButtons
              excelHref={`/api/rojmel/stock/export/excel?year=${year}&month=${month}`}
              pdfHref={`/api/rojmel/stock/export/pdf?year=${year}&month=${month}`}
            />
          </>
        }
      />

      <p className="mb-4 text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Opening pieces are entered once a month from a physical count. Closing pieces are the total sold this month
        (from day entries). Net pieces can go <strong style={{ color: 'var(--tint-negative-text)' }}>negative</strong> —
        that's intentional; it flags sales that weren't recorded.
      </p>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('rojmel.product', 'Product')}</th>
              <th style={{ textAlign: 'right' }}>{t('rojmel.rate', 'Rate')} (₹)</th>
              <th style={{ textAlign: 'right', color: 'var(--tint-rate-text)' }}>{t('rojmel.opening_pic', 'OPP.PIC')}</th>
              <th style={{ textAlign: 'right', color: 'var(--tint-total-text)' }}>{t('rojmel.closing_pic', 'CLO.PIC')}</th>
              <th style={{ textAlign: 'right' }}>{t('rojmel.net_pic', 'NET.PIC')}</th>
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
            {rows?.map((row) => {
              const net = displayedNet(row)
              const negative = net < 0
              return (
                <tr key={row.id}>
                  <td style={{ fontWeight: 500 }}>{row.product}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>₹{row.rate.toFixed(2)}</td>
                  <td className="cell-edit" style={{ maxWidth: 120 }}>
                    <NumberField
                      className="field-inline text-right"
                      value={displayedOpening(row)}
                      onChange={(v) => setEdited((prev) => ({ ...prev, [row.id]: v }))}
                      onBlur={() => commit(row)}
                      ariaLabel="Opening pieces"
                    />
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{row.closing_pic}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={negative ? 'pill pill-danger' : 'pill pill-accent'}>{net}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
