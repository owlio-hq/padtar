import { Routes, Route } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { BatchListPage } from './modules/shakkarpara/BatchListPage'
import { BatchFormPage } from './modules/shakkarpara/BatchFormPage'
import { DayListPage } from './modules/rojmel/DayListPage'
import { DayFormPage } from './modules/rojmel/DayFormPage'
import { StockPage } from './modules/rojmel/StockPage'
import { SettingsPage } from './modules/settings/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/rojmel" element={<DayListPage />} />
        <Route path="/rojmel/stock" element={<StockPage />} />
        <Route path="/rojmel/:id" element={<DayFormPage />} />
        <Route path="/shakkarpara" element={<BatchListPage />} />
        <Route path="/shakkarpara/:id" element={<BatchFormPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
