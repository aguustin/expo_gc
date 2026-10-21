import { useEffect, useRef } from 'react'
import { Button } from './Button.tsx'
import { Icon, type IconName } from './Icon.tsx'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  // Sin onCancel el diálogo es solo informativo (un único botón).
  cancelLabel?: string
  onCancel?: () => void
  icon?: IconName
}

// Diálogo modal grande, legible a distancia. Escape cancela; el foco arranca en la opción segura.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancelar',
  onCancel,
  icon = 'alert',
}: ConfirmDialogProps) {
  const safeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    safeButton.current?.focus()
    if (!onCancel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(22_26_36/0.55)] p-[4vw]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="rise-in w-full max-w-4xl rounded-[var(--radius-panel)] border border-white/60 bg-white p-10 text-center shadow-[var(--shadow-elev-3)]"
      >
        <span className="bg-accent-soft text-accent mx-auto grid h-20 w-20 place-items-center rounded-full">
          <Icon name={icon} className="h-11 w-11" />
        </span>
        <h2 id="confirm-title" className="font-display text-ink mt-5 text-4xl font-extrabold tracking-tight">
          {title}
        </h2>
        <p id="confirm-message" className="text-ink-2 mx-auto mt-4 max-w-3xl text-3xl leading-snug font-medium">
          {message}
        </p>
        <div className="mt-10 flex justify-center gap-6">
          {onCancel && (
            <Button ref={safeButton} variant="secondary" size="lg" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button ref={onCancel ? undefined : safeButton} size="lg" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
