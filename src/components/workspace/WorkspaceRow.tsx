import { useState } from 'react'
import type { FormEvent } from 'react'
import { useWorkspace } from '../../auth/useWorkspace'
import type { Workspace, WorkspaceRole } from '../../auth/workspace'

type Mode = 'view' | 'rename' | 'delete-confirm' | 'delete-type'

const roleLabels: Record<WorkspaceRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  employee: 'Employee',
}

const subtleButton = 'rounded-full bg-[#2d2d2d]/10 px-3 py-1.5 text-xs font-bold text-[#555555] disabled:opacity-50'
const darkButton = 'rounded-full bg-[#2d2d2d] px-3 py-1.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50'

export default function WorkspaceRow({ workspace, isActive }: { workspace: Workspace; isActive: boolean }) {
  const { switchWorkspace, renameWorkspace, deleteWorkspace, busy } = useWorkspace()
  const [mode, setMode] = useState<Mode>('view')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isOwner = workspace.role === 'owner'
  const canRename = isOwner || workspace.role === 'admin'

  const reset = () => {
    setMode('view')
    setValue('')
    setError(null)
  }

  const handleRename = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const message = await renameWorkspace(workspace.id, value)
    if (message) setError(message)
    else reset()
  }

  // Step 2 requires typing the exact name; on success the row unmounts.
  const handleDelete = async () => {
    setError(null)
    const message = await deleteWorkspace(workspace.id)
    if (message) setError(message)
  }

  return (
    <li className="rounded-xl bg-white/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{workspace.name}</p>
          <p className="text-xs font-medium text-[#555555]">
            {roleLabels[workspace.role]}
            {isActive && ' · Active'}
          </p>
        </div>
        {mode === 'view' && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {!isActive && (
              <button type="button" onClick={() => switchWorkspace(workspace.id)} className={darkButton}>
                Switch
              </button>
            )}
            {canRename && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setValue(workspace.name)
                  setMode('rename')
                }}
                className={subtleButton}
              >
                Rename
              </button>
            )}
            {isOwner && (
              <button type="button" disabled={busy} onClick={() => setMode('delete-confirm')} className={subtleButton}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {mode === 'rename' && (
        <form onSubmit={handleRename} className="mt-2 space-y-2">
          <input
            type="text"
            required
            autoFocus
            maxLength={60}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="New workspace name"
            className="w-full rounded-xl bg-white/50 px-3 py-2 text-sm font-medium"
          />
          <div className="flex gap-1.5">
            <button type="submit" disabled={busy || value.trim() === ''} className={darkButton}>Save</button>
            <button type="button" disabled={busy} onClick={reset} className={subtleButton}>Cancel</button>
          </div>
        </form>
      )}

      {mode === 'delete-confirm' && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-[#555555]">
            Step 1 of 2: move this workspace to Trash? It can be restored for 30 days.
          </p>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setMode('delete-type')} className={darkButton}>Continue</button>
            <button type="button" onClick={reset} className={subtleButton}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'delete-type' && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-medium text-[#555555]">
            Step 2 of 2: type <span className="font-bold text-[#2d2d2d]">{workspace.name}</span> to confirm.
          </p>
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label="Type the workspace name to confirm"
            className="w-full rounded-xl bg-white/50 px-3 py-2 text-sm font-medium"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy || value !== workspace.name}
              onClick={handleDelete}
              className="rounded-full bg-[#b3261e] px-3 py-1.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
            >
              {busy ? 'Moving...' : 'Move to Trash'}
            </button>
            <button type="button" disabled={busy} onClick={reset} className={subtleButton}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-xs font-bold text-[#b3261e]">{error}</p>}
    </li>
  )
}
