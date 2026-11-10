import { useAuth } from '../../auth/useAuth'
import { useWorkspace } from '../../auth/useWorkspace'
import CreateWorkspaceForm from '../../components/workspace/CreateWorkspaceForm'
import TrashList from '../../components/workspace/TrashList'
import AuthLayout from './AuthLayout'

export default function WorkspaceOnboardingPage() {
  const { signOut } = useAuth()
  const { trashed } = useWorkspace()

  return (
    <AuthLayout title="Create your workspace" subtitle="You need a workspace before you can use Junobi Arbor">
      <CreateWorkspaceForm />
      {trashed.length > 0 && (
        <div className="mt-5 border-t border-[#2d2d2d]/10 pt-4">
          <h2 className="mb-2 text-sm font-bold">Or restore from Trash</h2>
          <TrashList />
        </div>
      )}
      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-5 w-full rounded-full bg-[#2d2d2d]/10 px-4 py-2.5 text-xs font-bold text-[#555555]"
      >
        Log out
      </button>
    </AuthLayout>
  )
}
