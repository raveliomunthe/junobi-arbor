import { useState } from 'react'
import { MAX_OWNED_WORKSPACES } from '../../auth/workspace'
import { useWorkspace } from '../../auth/useWorkspace'
import CreateWorkspaceForm from './CreateWorkspaceForm'
import TrashList from './TrashList'
import WorkspaceRow from './WorkspaceRow'

type Tab = 'workspaces' | 'trash'

export default function WorkspacePanel() {
  const { workspaces, trashed, activeWorkspace, ownedCount } = useWorkspace()
  const [tab, setTab] = useState<Tab>('workspaces')

  const tabClass = (name: Tab) =>
    `rounded-full px-3 py-1.5 text-xs font-bold ${
      tab === name ? 'bg-[#2d2d2d] text-[#F5F5F5]' : 'bg-[#2d2d2d]/10 text-[#555555]'
    }`

  return (
    <section
      aria-label="Workspaces"
      className="navbar-edge-sheen navbar-shell pointer-events-auto flex w-full max-w-[380px] flex-col rounded-[24px] bg-[#f4f5f2]/50 p-3 font-['Montserrat',sans-serif] text-[#2d2d2d] backdrop-blur-[5px]"
      style={{ maxHeight: 'min(560px, calc(111.111111vh - 180px))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Workspaces</h2>
        <p className="text-xs font-bold text-[#555555]">{ownedCount}/{MAX_OWNED_WORKSPACES} owned</p>
      </div>
      <div className="mt-2 flex gap-1.5" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'workspaces'} onClick={() => setTab('workspaces')} className={tabClass('workspaces')}>
          My workspaces
        </button>
        <button type="button" role="tab" aria-selected={tab === 'trash'} onClick={() => setTab('trash')} className={tabClass('trash')}>
          Trash{trashed.length > 0 ? ` (${trashed.length})` : ''}
        </button>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto">
        {tab === 'workspaces' ? (
          <>
            <ul className="space-y-2">
              {workspaces.map((workspace) => (
                <WorkspaceRow key={workspace.id} workspace={workspace} isActive={workspace.id === activeWorkspace?.id} />
              ))}
            </ul>
            <div className="border-t border-[#2d2d2d]/10 pt-3">
              <CreateWorkspaceForm />
            </div>
          </>
        ) : (
          <TrashList />
        )}
      </div>
    </section>
  )
}
