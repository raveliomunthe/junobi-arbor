import { useState } from 'react'
import { MAX_OWNED_WORKSPACES, TRASH_RETENTION_DAYS } from '../../auth/workspace'
import { useWorkspace } from '../../auth/useWorkspace'

export default function TrashList() {
  const { trashed, restoreWorkspace, canCreate, busy } = useWorkspace()
  const [error, setError] = useState<string | null>(null)

  if (trashed.length === 0) {
    return <p className="text-xs font-medium text-[#555555]">Trash is empty.</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#555555]">
        Workspaces stay in Trash for {TRASH_RETENTION_DAYS} days before being permanently deleted.
      </p>
      {!canCreate && (
        <p className="text-xs font-medium text-[#555555]">
          Restoring needs a free slot ({MAX_OWNED_WORKSPACES}/{MAX_OWNED_WORKSPACES} owned).
        </p>
      )}
      {error && <p role="alert" className="text-xs font-bold text-[#b3261e]">{error}</p>}
      <ul className="space-y-2">
        {trashed.map((workspace) => {
          const { daysLeft } = workspace
          return (
            <li key={workspace.id} className="flex items-center gap-2 rounded-xl bg-white/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{workspace.name}</p>
                <p className="text-xs font-medium text-[#555555]">
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </p>
              </div>
              <button
                type="button"
                disabled={busy || !canCreate}
                onClick={async () => {
                  setError(null)
                  const message = await restoreWorkspace(workspace.id)
                  if (message) setError(message)
                }}
                className="shrink-0 rounded-full bg-[#2d2d2d] px-3 py-1.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
              >
                Restore
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
