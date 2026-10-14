import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Dialog({ open, onClose, title, description, children, className, sideContent }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; className?: string; sideContent?: React.ReactNode }) {
  const dialogId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement | null
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('keydown', keepFocusInside)
    requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ;(firstFocusable ?? dialogRef.current)?.focus()
    })
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('keydown', keepFocusInside)
      previousFocus.current?.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="flex min-h-full items-end justify-center sm:items-center">
        <div className={cn('relative flex min-h-0 max-h-[calc(100dvh-1.5rem)] w-full sm:max-h-[calc(100dvh-3rem)]', sideContent ? 'sm:max-w-lg' : 'sm:max-w-2xl')}>
          {sideContent && <div className="pointer-events-none absolute -top-20 left-4 z-20 sm:-left-28 sm:top-1/2 sm:-translate-y-1/2">{sideContent}</div>}
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`} aria-describedby={description ? `${dialogId}-description` : undefined} className={cn('motion-safe:animate-modal-in flex min-h-0 max-h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-2xl outline-none', className)}>
            <div className="flex shrink-0 items-start justify-between border-b bg-card/95 p-5 backdrop-blur">
              <div><h2 id={`${dialogId}-title`} className="text-lg font-bold">{title}</h2>{description && <p id={`${dialogId}-description`} className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>
              <button type="button" className="rounded-lg p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" onClick={onClose} aria-label="Close dialog"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
