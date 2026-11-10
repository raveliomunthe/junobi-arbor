import { useContext, useMemo, useSyncExternalStore } from 'react'
import { buildMetrics } from './finance'
import type { Metrics } from './finance'
import { DataContext } from './DataContext'
import type { DemoStore, Snapshot } from './store'

export function useDataStore(): DemoStore {
  const store = useContext(DataContext)
  if (!store) throw new Error('useDataStore must be used within a DataProvider')
  return store
}

export function useAppData(): Snapshot {
  const store = useDataStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot)
}

// Primitive selector: the navbar only re-renders when the unread count actually changes.
export function useUnreadCount(): number {
  const store = useDataStore()
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().data.notifications.filter((item) => !item.read).length)
}

// A shared "current time" that refreshes periodically, so "today" and relative times stay correct.
let nowSnapshot = Date.now()
const nowListeners = new Set<() => void>()
let nowTimer: ReturnType<typeof setInterval> | undefined

function subscribeNow(listener: () => void): () => void {
  nowListeners.add(listener)
  if (!nowTimer) {
    nowTimer = setInterval(() => {
      nowSnapshot = Date.now()
      nowListeners.forEach((notify) => notify())
    }, 20_000)
  }
  return () => {
    nowListeners.delete(listener)
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer)
      nowTimer = undefined
    }
  }
}

export function useNow(): number {
  return useSyncExternalStore(subscribeNow, () => nowSnapshot)
}

export function useMetrics(): Metrics {
  const { data } = useAppData()
  const now = useNow()
  return useMemo(() => buildMetrics(data, now), [data, now])
}
