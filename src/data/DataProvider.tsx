import { useState } from 'react'
import type { ReactNode } from 'react'
import { DataContext } from './DataContext'
import { createDemoStore } from './store'

// One store per scope (workspace), so switching workspaces never mixes local data.
export function DataProvider({ scopeId, children }: { scopeId: string; children: ReactNode }) {
  const [current, setCurrent] = useState(() => ({ scopeId, store: createDemoStore(scopeId) }))
  let { store } = current
  if (current.scopeId !== scopeId) {
    store = createDemoStore(scopeId)
    setCurrent({ scopeId, store })
  }
  return <DataContext.Provider value={store}>{children}</DataContext.Provider>
}
