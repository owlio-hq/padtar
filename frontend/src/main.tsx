import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './theme/ThemeContext'
import { LabelsProvider } from './i18n/LabelsContext'
import { AuthProvider } from './auth/AuthContext'
import { LoginGate } from './auth/LoginGate'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LabelsProvider>
          <AuthProvider>
            <LoginGate>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </LoginGate>
          </AuthProvider>
        </LabelsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
