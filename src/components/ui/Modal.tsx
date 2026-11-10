import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './icons'
import { secondaryButton } from './glass'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#2d2d2d]/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="navbar-edge-sheen navbar-shell max-h-[85vh] w-full max-w-[440px] overflow-y-auto rounded-[28px] bg-[#f4f5f2]/85 p-5 font-['Montserrat',sans-serif] text-[#2d2d2d] shadow-2xl backdrop-blur-[12px] outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className={`${secondaryButton} !p-2`}>
            <Icon name="close" className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
