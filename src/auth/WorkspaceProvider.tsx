import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { WorkspaceContext } from './WorkspaceContext'
import type { TrashedWorkspace, WorkspaceContextValue } from './WorkspaceContext'
import {
  MAX_OWNED_WORKSPACES,
  createWorkspace as createWorkspaceRequest,
  fetchWorkspaces,
  getTrashDaysLeft,
  readStoredActiveWorkspaceId,
  renameWorkspace as renameWorkspaceRequest,
  restoreWorkspace as restoreWorkspaceRequest,
  softDeleteWorkspace as softDeleteWorkspaceRequest,
  storeActiveWorkspaceId,
} from './workspace'
import type { Workspace } from './workspace'

type MutationResult = string | undefined | void

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

// Mount with key={userId}: all state (list, selection, in-flight requests) is per user,
// so a different account can never inherit another account's workspace state.
export function WorkspaceProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [all, setAll] = useState<Workspace[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => readStoredActiveWorkspaceId(userId))
  const [busy, setBusy] = useState(false)
  // Captured when data is fetched so render stays pure.
  const [fetchedAt, setFetchedAt] = useState(() => Date.now())
  const requestCounter = useRef(0)
  const busyRef = useRef(false)

  // Newest request wins; responses from older requests are ignored.
  const refresh = useCallback(
    async (selectId?: string): Promise<string | null> => {
      const requestId = ++requestCounter.current
      try {
        const list = await fetchWorkspaces(userId)
        if (selectId) setSelectedId(selectId)
        if (requestId !== requestCounter.current) return null
        setAll(list)
        setFetchedAt(Date.now())
        setLoadError(null)
        return null
      } catch (error) {
        if (requestId !== requestCounter.current) return null
        const message = messageOf(error)
        setLoadError(message)
        return message
      }
    },
    [userId],
  )

  useEffect(() => {
    const requestId = ++requestCounter.current
    fetchWorkspaces(userId).then(
      (list) => {
        if (requestId !== requestCounter.current) return
        setAll(list)
        setFetchedAt(Date.now())
        setLoadError(null)
      },
      (error) => {
        if (requestId === requestCounter.current) setLoadError(messageOf(error))
      },
    )
    return () => {
      requestCounter.current += 1
    }
  }, [userId])

  const active = useMemo(() => (all ?? []).filter((w) => !w.deletedAt), [all])
  const trashed = useMemo<TrashedWorkspace[]>(
    () =>
      (all ?? []).flatMap((w) => {
        if (!w.deletedAt || w.role !== 'owner') return []
        const daysLeft = getTrashDaysLeft(w.deletedAt, fetchedAt)
        return daysLeft > 0 ? [{ ...w, daysLeft }] : []
      }),
    [all, fetchedAt],
  )

  // Always derived from the server list, so the active workspace can never point at a
  // deleted workspace or one the user no longer belongs to.
  const activeWorkspace = useMemo(
    () => active.find((w) => w.id === selectedId) ?? active[0] ?? null,
    [active, selectedId],
  )
  const activeId = activeWorkspace?.id ?? null

  useEffect(() => {
    if (all) storeActiveWorkspaceId(userId, activeId)
  }, [all, userId, activeId])

  const ownedCount = useMemo(() => active.filter((w) => w.role === 'owner').length, [active])

  // One mutation at a time per tab; the database enforces the cap across tabs/devices.
  const run = useCallback(
    async (action: () => Promise<MutationResult>): Promise<string | null> => {
      if (busyRef.current) return 'Another workspace action is in progress. Please wait.'
      busyRef.current = true
      setBusy(true)
      let error: string | null = null
      let selectId: string | undefined
      try {
        selectId = (await action()) || undefined
      } catch (caught) {
        error = messageOf(caught)
      }
      await refresh(selectId)
      busyRef.current = false
      setBusy(false)
      return error
    },
    [refresh],
  )

  const reload = useCallback(async () => {
    setLoadError(null)
    await refresh()
  }, [refresh])

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (active.some((w) => w.id === workspaceId)) setSelectedId(workspaceId)
    },
    [active],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      status: all ? 'ready' : loadError ? 'error' : 'loading',
      loadError,
      workspaces: active,
      trashed,
      activeWorkspace,
      ownedCount,
      canCreate: ownedCount < MAX_OWNED_WORKSPACES,
      busy,
      reload,
      switchWorkspace,
      createWorkspace: (name) => run(() => createWorkspaceRequest(name)),
      renameWorkspace: (workspaceId, name) => run(() => renameWorkspaceRequest(workspaceId, name)),
      deleteWorkspace: (workspaceId) => run(() => softDeleteWorkspaceRequest(workspaceId)),
      restoreWorkspace: (workspaceId) =>
        run(async () => {
          await restoreWorkspaceRequest(workspaceId)
        }),
    }),
    [all, loadError, active, trashed, activeWorkspace, ownedCount, busy, reload, switchWorkspace, run],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
