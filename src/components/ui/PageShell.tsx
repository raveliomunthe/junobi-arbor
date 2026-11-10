import { useId } from 'react'
import type { ReactNode } from 'react'

// Same title chip + translucent panel the Overview page already used. The bottom padding keeps
// content clear of the floating navbar.
export default function PageShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex min-h-[calc(111.111111vh-62px)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          id={titleId}
          className="navbar-edge-sheen navbar-shell flex h-[58px] shrink-0 items-center self-start rounded-[32px] bg-[#f4f5f2]/50 px-4 text-center font-['Montserrat',sans-serif] text-[28px] font-black text-[#2d2d2d] backdrop-blur-[5px]"
        >
          {title}
        </h1>
        {actions}
      </div>
      <div className="navbar-edge-sheen min-h-0 flex-1 rounded-[32px] bg-white/70 p-3 pb-28">{children}</div>
    </section>
  )
}
