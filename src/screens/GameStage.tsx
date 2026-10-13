import type { ComponentType } from 'react'
import { AppShell } from '../components/AppShell.tsx'
import { ExitToMenuButton } from '../components/ExitToMenuButton.tsx'
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

  return (
    <AppShell
      aside={
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-display text-3xl uppercase">
              <span aria-hidden="true">{game.icon} </span>
              {game.title}
            </p>
            {state.mode?.kind === 'challenge' && (
              <p className="text-accent-2 text-lg font-bold uppercase">
                Desafío completo · Juego {state.gameIndex + 1} de {CHALLENGE_ORDER.length}
              </p>
            )}
          </div>
          <ExitToMenuButton />
        </div>
      }
    >
      <Scoreboard teams={state.teams} activeTeamId={state.activeTeamId} />

      <section className="mt-[2.5vh] flex flex-1 flex-col">
        {/* La key garantiza un juego nuevo (estado y timers limpios) en cada posición del desafío. */}
        <Game key={`${state.gameIndex}-${gameId}`} />
      </section>
    </AppShell>
  )
}
