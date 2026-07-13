import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Wallet, Package, Settings } from 'lucide-react'
import { Logo } from './Logo'
import { TopBar } from './TopBar'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'
import { useLabels } from '../i18n/LabelsContext'

const TOP_ITEMS = [{ to: '/', labelKey: 'nav.dashboard', fallback: 'Dashboard', icon: LayoutDashboard }]

const MODULE_ITEMS = [
  { to: '/rojmel', labelKey: 'nav.rojmel', fallback: 'Rojmel', icon: Wallet },
  { to: '/shakkarpara', labelKey: 'nav.shakkarpara', fallback: 'Shakkarpara', icon: Package },
]

const SYSTEM_ITEMS = [{ to: '/settings', labelKey: 'nav.settings', fallback: 'Settings', icon: Settings }]

export function AppShell() {
  const { t } = useLabels()

  const renderItem = (item: { to: string; labelKey: string; fallback: string; icon: typeof Wallet }) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <Icon size={17} />
        {t(item.labelKey, item.fallback)}
      </NavLink>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--surface-alt)' }}>
      <aside
        className="app-sidebar flex h-full w-60 shrink-0 flex-col overflow-y-auto border-r px-3 py-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
      >
        <div className="mb-5 flex items-center gap-2.5 px-2">
          <Logo size={30} />
          <div>
            <div className="text-sm font-medium leading-tight" style={{ color: 'var(--text)' }}>
              {t('app.name', 'Padtar')}
            </div>
            <div className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              {t('app.tagline', 'Factory Ledger')}
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {TOP_ITEMS.map(renderItem)}

          <div className="nav-section">Modules</div>
          {MODULE_ITEMS.map(renderItem)}

          <div className="nav-section">System</div>
          {SYSTEM_ITEMS.map(renderItem)}
        </nav>

        <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          <ThemeToggle />
          <LangToggle />
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="app-main flex-1 overflow-y-auto px-8 py-7">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
