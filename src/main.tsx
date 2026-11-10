import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import AuthGate from './auth/AuthGate.tsx'

import DemoProviders from './auth/DemoProviders.tsx'
import { isDemoMode } from './auth/demo.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDemoMode ? (
      <DemoProviders>
        <App />
      </DemoProviders>
    ) : (
      <AuthProvider>
        <AuthGate>
          <App />
        </AuthGate>
      </AuthProvider>
    )}
  </StrictMode>,
)
