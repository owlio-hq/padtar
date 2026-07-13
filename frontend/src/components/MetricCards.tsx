export interface Metric {
  label: string
  value: string
  accent?: boolean
}

export function MetricCards({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="mb-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
      {metrics.map((m) => (
        <div key={m.label} className="metric-card">
          <div className="metric-label">{m.label}</div>
          <div className="metric-value" style={m.accent ? { color: 'var(--tint-padtar-text)' } : undefined}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  )
}
