import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import AuthGate from './auth/AuthGate.tsx'

import DemoProviders from './auth/DemoProviders.tsx'
import { isDemoMode, readDemoSession, writeDemoSession } from './auth/demo.ts'

export function Root() {
  const [inDemo, setInDemo] = useState(() => readDemoSession() ?? isDemoMode)

  const startDemo = () => {
    writeDemoSession(true)
    setInDemo(true)
  }
  const exitDemo = () => {
    writeDemoSession(false)
    setInDemo(false)
  }

  if (inDemo) {
    return (
      <DemoProviders autoSignIn={!isDemoMode} onExit={exitDemo}>
        <App inDemo onSwitchMode={exitDemo} />
      </DemoProviders>
    )
  }

  return (
    <AuthProvider>
      <AuthGate onTryDemo={startDemo}>
        <App onSwitchMode={startDemo} />
      </AuthGate>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
