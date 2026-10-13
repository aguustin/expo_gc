import { useEffect, useRef } from 'react'
import { Button } from './Button.tsx'

type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  // Sin onCancel el diálogo es solo informativo (un único botón).
  cancelLabel?: string
  onCancel?: () => void
}

// Diálogo modal grande, legible a distancia. Escape cancela; el foco arranca en la opción segura.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, cancelLabel = 'Cancelar', onCancel }: ConfirmDialogProps) {
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
    <div className="bg-night/80 fixed inset-0 z-50 grid place-items-center p-[4vw] backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="bg-surface w-full max-w-4xl rounded-[2rem] p-10 text-center ring-4 ring-white/15"
      >
        <h2 id="confirm-title" className="font-display text-4xl uppercase">
          {title}
        </h2>
        <p id="confirm-message" className="text-muted mt-5 text-3xl font-semibold">
          {message}
        </p>
        <div className="mt-10 flex justify-center gap-6">
          {onCancel && (
            <Button ref={safeButton} variant="secondary" className="px-10 py-5 text-2xl" onClick={onCancel}>
              {cancelLabel}
            </Button>
          )}
          <Button ref={onCancel ? undefined : safeButton} className="px-10 py-5 text-2xl" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
