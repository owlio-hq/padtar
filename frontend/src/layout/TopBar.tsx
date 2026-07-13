import { useLocation } from 'react-router-dom'
import { LayoutDashboard, Wallet, Package, Settings } from 'lucide-react'
import { useLabels } from '../i18n/LabelsContext'

type Section = { icon: typeof Wallet; labelKey: string; fallback: string; sub?: string }

function resolveSection(pathname: string): Section {
  if (pathname.startsWith('/rojmel')) {
    let sub: string | undefined
    if (pathname === '/rojmel/stock') sub = 'Stock'
    else if (pathname === '/rojmel/new') sub = 'New day'
    else if (/^\/rojmel\/\d+$/.test(pathname)) sub = 'Day'
    return { icon: Wallet, labelKey: 'nav.rojmel', fallback: 'Rojmel', sub }
  }
  if (pathname.startsWith('/shakkarpara')) {
    let sub: string | undefined
    if (pathname === '/shakkarpara/new') sub = 'New batch'
    else if (/^\/shakkarpara\/\d+$/.test(pathname)) sub = 'Batch'
    return { icon: Package, labelKey: 'nav.shakkarpara', fallback: 'Shakkarpara', sub }
  }
  if (pathname.startsWith('/settings')) return { icon: Settings, labelKey: 'nav.settings', fallback: 'Settings' }
  return { icon: LayoutDashboard, labelKey: 'nav.dashboard', fallback: 'Dashboard' }
}

/**
 * Slim breadcrumb bar. The old global "+ New" dropdown was removed — every
 * relevant page has its own "New batch" / "New day" button so a second
 * global one just doubled up (and appeared on Settings where it was meaningless).
 */
export function TopBar() {
  const { t } = useLabels()
  const { pathname } = useLocation()
  const section = resolveSection(pathname)
  const Icon = section.icon

  return (
    <header
      className="app-topbar flex h-12 shrink-0 items-center border-b px-6"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
        <Icon size={15} style={{ color: 'var(--text-muted)' }} />
        <span className="font-medium">{t(section.labelKey, section.fallback)}</span>
        {section.sub && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>{section.sub}</span>
          </>
        )}
      </div>
    </header>
  )
}
