import { useEffect, useRef, type ReactNode } from 'react'

/** Modal dialog: focus on its first button, Escape closes it when it can be closed. */
export function Modal({
  testId,
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose?: () => void
  testId?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])
  return (
    <div className="modal-backdrop">
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onClose) onClose()
        }}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
