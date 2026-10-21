import { useState } from 'react'
import { ConfirmDialog } from './components/ConfirmDialog.tsx'
import { GameStage } from './screens/GameStage.tsx'
import { MainMenu } from './screens/MainMenu.tsx'
import { Results } from './screens/Results.tsx'
import { TeamSetup } from './screens/TeamSetup.tsx'
import { Welcome } from './screens/Welcome.tsx'
import { SessionProvider, useSession } from './state/SessionContext.tsx'

function CurrentScreen() {
  const { state } = useSession()
  // La bienvenida es solo visual: no forma parte de la sesión ni se guarda. Se muestra al abrir
  // la app (salvo que se haya recuperado una partida en curso) y al tocar «Inicio» en el menú.
  const [showWelcome, setShowWelcome] = useState(() => state.phase === 'menu')

  switch (state.phase) {
    case 'menu':
      return showWelcome ? (
        <Welcome onStart={() => setShowWelcome(false)} />
      ) : (
        <MainMenu onHome={() => setShowWelcome(true)} />
      )
    case 'setup':
      return <TeamSetup />
    case 'playing':
      return <GameStage />
    case 'intermission':
    case 'results':
      return <Results />
  }
}

function RecoveryNotice() {
  const { recoveryFailed, discardFailedRecovery } = useSession()
  if (!recoveryFailed) return null
  return (
    <ConfirmDialog
      title="No se pudo recuperar la partida"
      message="Había una partida guardada, pero sus datos están incompletos o no corresponden a esta versión de la aplicación."
      icon="refresh"
      confirmLabel="Comenzar una nueva partida"
      onConfirm={discardFailedRecovery}
    />
  )
}

export default function App() {
  return (
    <SessionProvider>
      <CurrentScreen />
      <RecoveryNotice />
    </SessionProvider>
  )
}
