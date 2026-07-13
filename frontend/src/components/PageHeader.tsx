import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  backLabel?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, backTo, backLabel, actions }: PageHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {backTo && (
            <Link to={backTo} className="back-circle" title={backLabel ?? 'Back'} aria-label={backLabel ?? 'Back'}>
              <ChevronLeft size={17} />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
              {title}
            </h1>
            {subtitle && (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="page-header-actions flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
