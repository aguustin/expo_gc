import { Button } from './Button.tsx'
import { ExitToMenuButton } from './ExitToMenuButton.tsx'

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
      className="bg-surface/70 border-accent flex flex-1 flex-col items-center justify-center gap-6 rounded-[2rem] border-4 border-dashed p-10 text-center"
    >
      <span className="text-8xl" aria-hidden="true">
        ⚠️
      </span>
      <p className="font-display text-4xl uppercase">{message}</p>
      <p className="text-muted max-w-4xl text-2xl font-semibold">{detail}</p>
      <div className="mt-4 flex gap-6">
        {onRetry && (
          <Button className="px-10 py-5 text-2xl" onClick={onRetry}>
            Reintentar
          </Button>
        )}
        <ExitToMenuButton label="Volver al menú" variant={onRetry ? 'secondary' : 'primary'} className="px-10 py-5 text-2xl" />
      </div>
    </div>
  )
}
