import { Routes, Route } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { BatchListPage } from './modules/shakkarpara/BatchListPage'
import { BatchFormPage } from './modules/shakkarpara/BatchFormPage'
import { DayListPage } from './modules/rojmel/DayListPage'
import { DayFormPage } from './modules/rojmel/DayFormPage'
import { StockPage } from './modules/rojmel/StockPage'
import { SettingsPage } from './modules/settings/SettingsPage'
import { NotificationsPage } from './modules/notifications/NotificationsPage'
import { UpdateProvider } from './system/UpdateContext'

function App() {
  return (
    <Routes>
      {/* the provider wraps the shell so the sidebar, the toast and the
          Notifications page all read the same update state */}
      <Route
        element={
          <UpdateProvider>
            <AppShell />
          </UpdateProvider>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/rojmel" element={<DayListPage />} />
        <Route path="/rojmel/stock" element={<StockPage />} />
        <Route path="/rojmel/:id" element={<DayFormPage />} />
        <Route path="/shakkarpara" element={<BatchListPage />} />
        <Route path="/shakkarpara/:id" element={<BatchFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  )
}

export default App
