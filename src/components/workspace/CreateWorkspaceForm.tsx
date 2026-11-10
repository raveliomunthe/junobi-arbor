import { useState } from 'react'
import type { FormEvent } from 'react'
import { MAX_OWNED_WORKSPACES } from '../../auth/workspace'
import { useWorkspace } from '../../auth/useWorkspace'

export default function CreateWorkspaceForm() {
  const { createWorkspace, canCreate, ownedCount, busy } = useWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(null)
    const message = await createWorkspace(name)
    if (message) setError(message)
    else setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-xs font-bold">Workspace name
        <input
          type="text"
          required
          maxLength={60}
          value={name}
          disabled={!canCreate}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. My Shop"
          className="mt-1.5 w-full rounded-xl bg-white/50 px-3 py-2.5 text-sm font-medium disabled:opacity-50"
        />
      </label>
      {!canCreate && (
        <p className="text-xs font-medium text-[#555555]">
          You own {ownedCount}/{MAX_OWNED_WORKSPACES} workspaces. Move one to Trash to create another.
        </p>
      )}
      {error && <p role="alert" className="text-xs font-bold text-[#b3261e]">{error}</p>}
      <button
        type="submit"
        disabled={busy || !canCreate || name.trim() === ''}
        className="w-full rounded-full bg-[#2d2d2d] px-4 py-2.5 text-xs font-bold text-[#F5F5F5] disabled:opacity-50"
      >
        {busy ? 'Working...' : 'Create workspace'}
      </button>
    </form>
  )
}
