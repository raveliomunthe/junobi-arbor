import { glassCardPadded } from '../ui/glass'
import type { ReactNode } from 'react'
import { useId } from 'react'

export default function Section({
  id,
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  id?: string
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section id={id} aria-labelledby={titleId} className={`${glassCardPadded} scroll-mt-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-black">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-[#555555]">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
