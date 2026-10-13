import { createContext, useContext, useEffect, useReducer, useState, type Dispatch, type ReactNode } from 'react'
import { clearSavedSession, persistSession, recoverSession } from './persistence.ts'
import { initialSessionState, sessionReducer, type SessionAction, type SessionState } from './session.ts'

type SessionContextValue = {
  state: SessionState
  dispatch: Dispatch<SessionAction>
  // true si había una partida guardada que no se pudo recuperar (se informa antes de descartarla).
  recoveryFailed: boolean
  discardFailedRecovery: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [recovery] = useState(recoverSession)
  const [state, dispatch] = useReducer(sessionReducer, initialSessionState, (initial) =>
    recovery.status === 'restored' ? recovery.session : initial,
  )
  const [recoveryFailed, setRecoveryFailed] = useState(recovery.status === 'failed')

  // Mientras se muestra el aviso de recuperación fallida no se escribe nada, para no borrar
  // lo guardado antes de que la persona lo confirme.
  useEffect(() => {
    if (!recoveryFailed) persistSession(state)
  }, [state, recoveryFailed])

  function discardFailedRecovery() {
    clearSavedSession()
    setRecoveryFailed(false)
  }

  return (
    <SessionContext.Provider value={{ state, dispatch, recoveryFailed, discardFailedRecovery }}>
      {children}
    </SessionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- el hook y su provider van juntos
export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession debe usarse dentro de <SessionProvider>')
  return context
}
