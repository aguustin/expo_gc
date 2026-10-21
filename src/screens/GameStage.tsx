import type { ComponentType } from 'react'
import { AppShell } from '../components/AppShell.tsx'
import { ChallengeProgress } from '../components/ChallengeProgress.tsx'
import { ExitToMenuButton } from '../components/ExitToMenuButton.tsx'
import { GAME_ICONS } from '../components/gameIcons.ts'
import { Icon } from '../components/Icon.tsx'
import { Scoreboard } from '../components/Scoreboard.tsx'
import { getGame } from '../games/catalog.ts'
import { LocationGame } from '../games/location/LocationGame.tsx'
import { MemoryGame } from '../games/memory/MemoryGame.tsx'
import { RouletteGame } from '../games/roulette/RouletteGame.tsx'
import { CHALLENGE_ORDER, currentGameId, type GameId } from '../state/session.ts'
import { useSession } from '../state/SessionContext.tsx'

// Juegos implementados. Cada uno usa la sesión compartida para puntajes y turnos
// y despacha finishGame al terminar; qué juego sigue lo decide la sesión.
const GAME_COMPONENTS: Record<GameId, ComponentType> = {
  roulette: RouletteGame,
  memory: MemoryGame,
  location: LocationGame,
}

// Estructura común de partida: encabezado, marcador compartido y área de juego.
export function GameStage() {
  const { state } = useSession()
  const gameId = currentGameId(state)
  if (!gameId) return null
  const game = getGame(gameId)
  const Game = GAME_COMPONENTS[gameId]
  const isChallenge = state.mode?.kind === 'challenge'

  return (
    <AppShell
      fitScreen
      aside={
        <div className="flex items-center gap-6">
          {isChallenge && <ChallengeProgress gameIndex={state.gameIndex} currentDone={false} compact />}
          <div className="flex items-center gap-3">
            <span className="bg-accent grid h-14 w-14 place-items-center rounded-2xl text-white shadow-[0_3px_0_var(--color-accent-deep)]">
              <Icon name={GAME_ICONS[gameId]} className="h-8 w-8" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-ink text-3xl font-extrabold tracking-tight">{game.title}</p>
              {isChallenge && (
                <p className="text-accent text-lg font-bold">
                  Desafío completo · Juego {state.gameIndex + 1} de {CHALLENGE_ORDER.length}
                </p>
              )}
            </div>
          </div>
          <ExitToMenuButton />
        </div>
      }
    >
      <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId} />

      <section className="mt-[2.2vh] flex min-h-0 flex-1 flex-col">
        {/* La key garantiza un juego nuevo (estado y timers limpios) en cada posición del desafío. */}
        <Game key={`${state.gameIndex}-${gameId}`} />
      </section>
    </AppShell>
  )
}
