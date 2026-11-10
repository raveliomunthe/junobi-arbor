import { supabase } from '../lib/supabase'

export const MAX_OWNED_WORKSPACES = 3
export const TRASH_RETENTION_DAYS = 30

export type WorkspaceRole = 'owner' | 'admin' | 'manager' | 'employee'

export type Workspace = {
  id: string
  name: string
  ownerId: string
  role: WorkspaceRole
  createdAt: string
  deletedAt: string | null
}

type WorkspaceRow = {
  id: string
  name: string
  owner_id: string
  created_at: string
  deleted_at: string | null
}

export class WorkspaceError extends Error {}

const messagesByCode: Record<string, string> = {
  not_authenticated: 'Your session has expired. Please log in again.',
  invalid_name: 'Workspace name must be 1 to 60 characters.',
  workspace_limit_reached: `You can own at most ${MAX_OWNED_WORKSPACES} active workspaces.`,
  workspace_not_found: 'Workspace not found, or you do not have permission to do that.',
  restore_expired: 'This workspace was in Trash for more than 30 days and can no longer be restored.',
}

const setupMissingCodes = ['PGRST202', 'PGRST205', '42P01', '42883']

function toWorkspaceError(error: { message: string; code?: string }) {
  const known = Object.keys(messagesByCode).find((code) => error.message.includes(code))
  if (known) return new WorkspaceError(messagesByCode[known])
  if (error.code && setupMissingCodes.includes(error.code)) {
    return new WorkspaceError('The workspace database is not set up yet. Apply the workspace migration first.')
  }
  if (/failed to fetch|network/i.test(error.message)) {
    return new WorkspaceError('Unable to reach the server. Check your connection and try again.')
  }
  return new WorkspaceError('Something went wrong. Please try again.')
}

function toWorkspace(row: WorkspaceRow, role: WorkspaceRole): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    role,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  }
}

function rethrow(error: unknown): never {
  throw error instanceof WorkspaceError ? error : toWorkspaceError(error as Error)
}

// Row Level Security decides what is returned: the user's non-deleted workspaces plus
// their own trashed ones. Isolation does not rely on any frontend filtering.
export async function fetchWorkspaces(userId: string): Promise<Workspace[]> {
  try {
    const [workspaces, memberships] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id, name, owner_id, created_at, deleted_at')
        .order('created_at', { ascending: true }),
      supabase.from('workspace_members').select('workspace_id, role').eq('user_id', userId),
    ])
    if (workspaces.error) throw toWorkspaceError(workspaces.error)
    if (memberships.error) throw toWorkspaceError(memberships.error)

    const roles = new Map<string, WorkspaceRole>(
      (memberships.data as { workspace_id: string; role: WorkspaceRole }[]).map((m) => [m.workspace_id, m.role]),
    )
    return (workspaces.data as WorkspaceRow[]).flatMap((row) => {
      const role = roles.get(row.id)
      return role ? [toWorkspace(row, role)] : []
    })
  } catch (error) {
    return rethrow(error)
  }
}

async function callRpc(name: string, args: Record<string, string>): Promise<WorkspaceRow> {
  try {
    const { data, error } = await supabase.rpc(name, args)
    if (error) throw toWorkspaceError(error)
    return data as WorkspaceRow
  } catch (error) {
    return rethrow(error)
  }
}

// Returns the id of the created workspace so the caller can make it active.
export async function createWorkspace(name: string): Promise<string> {
  return (await callRpc('create_workspace', { p_name: name })).id
}

export async function renameWorkspace(workspaceId: string, name: string): Promise<void> {
  await callRpc('rename_workspace', { p_workspace_id: workspaceId, p_name: name })
}

export async function softDeleteWorkspace(workspaceId: string): Promise<void> {
  await callRpc('soft_delete_workspace', { p_workspace_id: workspaceId })
}

export async function restoreWorkspace(workspaceId: string): Promise<void> {
  await callRpc('restore_workspace', { p_workspace_id: workspaceId })
}

export function getTrashDaysLeft(deletedAt: string, now: number): number {
  const expiresAt = new Date(deletedAt).getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  return Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000))
}

const activeKey = (userId: string) => `junobi:activeWorkspace:${userId}`

export function readStoredActiveWorkspaceId(userId: string): string | null {
  try {
    return window.localStorage.getItem(activeKey(userId))
  } catch {
    return null
  }
}

export function storeActiveWorkspaceId(userId: string, workspaceId: string | null) {
  try {
    if (workspaceId) window.localStorage.setItem(activeKey(userId), workspaceId)
    else window.localStorage.removeItem(activeKey(userId))
  } catch {
    // Storage unavailable (private mode, quota): the active workspace just won't persist.
  }
}
