import { useState } from 'react'
import { useSession } from '../state/SessionContext.tsx'
import { Button } from './Button.tsx'
import { ConfirmDialog } from './ConfirmDialog.tsx'
import { Icon } from './Icon.tsx'

type ExitToMenuButtonProps = {
  label?: string
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'lg' | 'xl'
}

// Vuelve al menú. Si hay una partida en curso (juego o pausa del desafío), pide confirmación
// porque salir descarta el progreso; si no, sale directamente.
export function ExitToMenuButton({ label = 'Salir al menú', variant = 'secondary', size = 'md' }: ExitToMenuButtonProps) {
  const { state, dispatch } = useSession()
  const [confirming, setConfirming] = useState(false)
  const hasActiveGame = state.phase === 'playing' || state.phase === 'intermission'

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => (hasActiveGame ? setConfirming(true) : dispatch({ type: 'backToMenu' }))}
      >
        <Icon name="exit" className="h-6 w-6" />
        {label}
      </Button>
      {confirming && (
        <ConfirmDialog
          title="¿Salir de la partida?"
          message="Si salís ahora, perderás el progreso de esta partida. ¿Querés volver al menú?"
          icon="exit"
          cancelLabel="Seguir jugando"
          onCancel={() => setConfirming(false)}
          confirmLabel="Sí, volver al menú"
          onConfirm={() => dispatch({ type: 'backToMenu' })}
        />
      )}
    </>
  )
}
