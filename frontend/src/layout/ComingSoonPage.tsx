import { Construction } from 'lucide-react'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-28 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded"
        style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        <Construction size={22} />
      </div>
      <div>
        <h1 className="text-lg font-medium" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Coming soon.
        </p>
      </div>
    </div>
  )
}
