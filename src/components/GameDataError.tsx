import { Button } from './Button.tsx'
import { ExitToMenuButton } from './ExitToMenuButton.tsx'
import { Icon } from './Icon.tsx'

type GameDataErrorProps = {
  message: string
  detail: string
  // Solo se ofrece reintentar cuando el reintento puede resolver el problema.
  onRetry?: () => void
}

// Error que impide jugar un juego. No lo da por terminado, no avanza al siguiente
// ni toca puntajes o turnos: solo permite volver al menú (o reintentar si aplica).
export function GameDataError({ message, detail, onRetry }: GameDataErrorProps) {
  return (
    <div
      role="alert"
      className="surface-raised rise-in flex flex-1 flex-col items-center justify-center gap-6 rounded-[var(--radius-panel)] p-10 text-center"
    >
      <span className="bg-danger-soft text-danger grid h-24 w-24 place-items-center rounded-full">
        <Icon name="alert" className="h-14 w-14" />
      </span>
      <p className="font-display text-ink text-4xl font-extrabold tracking-tight">{message}</p>
      <p className="text-ink-2 max-w-4xl text-2xl leading-snug font-medium">{detail}</p>
      <div className="mt-4 flex gap-6">
        {onRetry && (
          <Button size="lg" onClick={onRetry}>
            <Icon name="refresh" className="h-7 w-7" />
            Reintentar
          </Button>
        )}
        <ExitToMenuButton label="Volver al menú" variant={onRetry ? 'secondary' : 'primary'} size="lg" />
      </div>
    </div>
  )
}
