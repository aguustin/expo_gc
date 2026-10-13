import { useState } from 'react'
import { useSession } from '../state/SessionContext.tsx'
import { Button } from './Button.tsx'
import { ConfirmDialog } from './ConfirmDialog.tsx'

type ExitToMenuButtonProps = {
  label?: string
  variant?: 'primary' | 'secondary'
  className?: string
}

// Vuelve al menú. Si hay una partida en curso (juego o pausa del desafío), pide confirmación
// porque salir descarta el progreso; si no, sale directamente.
export function ExitToMenuButton({ label = 'Salir al menú', variant = 'secondary', className }: ExitToMenuButtonProps) {
  const { state, dispatch } = useSession()
  const [confirming, setConfirming] = useState(false)
  const hasActiveGame = state.phase === 'playing' || state.phase === 'intermission'

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => (hasActiveGame ? setConfirming(true) : dispatch({ type: 'backToMenu' }))}
      >
        {label}
      </Button>
      {confirming && (
        <ConfirmDialog
          title="¿Salir de la partida?"
          message="Si salís ahora, perderás el progreso de esta partida. ¿Querés volver al menú?"
          cancelLabel="Seguir jugando"
          onCancel={() => setConfirming(false)}
          confirmLabel="Sí, volver al menú"
          onConfirm={() => dispatch({ type: 'backToMenu' })}
        />
      )}
    </>
  )
}
