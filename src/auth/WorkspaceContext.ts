import { createContext } from 'react'
import type { Workspace } from './workspace'

export type TrashedWorkspace = Workspace & { daysLeft: number }

export type WorkspaceContextValue = {
  status: 'loading' | 'ready' | 'error'
  loadError: string | null
  // Non-deleted workspaces the user belongs to (owned and joined).
  workspaces: Workspace[]
  // The user's own workspaces in Trash that can still be restored.
  trashed: TrashedWorkspace[]
  activeWorkspace: Workspace | null
  ownedCount: number
  canCreate: boolean
  busy: boolean
  reload: () => Promise<void>
  switchWorkspace: (workspaceId: string) => void
  // Mutations resolve to an error message, or null on success.
  createWorkspace: (name: string) => Promise<string | null>
  renameWorkspace: (workspaceId: string, name: string) => Promise<string | null>
  deleteWorkspace: (workspaceId: string) => Promise<string | null>
  restoreWorkspace: (workspaceId: string) => Promise<string | null>
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
