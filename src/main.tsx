import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import AuthGate from './auth/AuthGate.tsx'

import DemoProviders from './auth/DemoProviders.tsx'
import { isDemoMode, readDemoSession, writeDemoSession } from './auth/demo.ts'

function Root() {
  const [inDemo, setInDemo] = useState(readDemoSession)

  const startDemo = () => {
    writeDemoSession(true)
    setInDemo(true)
  }
  const exitDemo = () => {
    writeDemoSession(false)
    setInDemo(false)
  }

  // Build-time demo-only mode: demo login screen, real auth never mounts.
  if (isDemoMode) {
    return (
      <DemoProviders>
        <App />
      </DemoProviders>
    )
  }

  // Runtime demo opened from "Try demo": signed in straight away, logout returns to real login.
  if (inDemo) {
    return (
      <DemoProviders autoSignIn onExit={exitDemo}>
        <App />
      </DemoProviders>
    )
  }

  return (
    <AuthProvider>
      <AuthGate onTryDemo={startDemo}>
        <App />
      </AuthGate>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
