import { AppShell } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { ExitToMenuButton } from '../components/ExitToMenuButton.tsx'
import { teamColor } from '../components/teamColor.ts'
import { getGame } from '../games/catalog.ts'
import { useSession } from '../state/SessionContext.tsx'
import { CHALLENGE_ORDER, rankTeams } from '../state/session.ts'

// Clasificación con puntajes acumulados. Sirve como resultado final (phase 'results')
// y como pausa entre juegos del desafío (phase 'intermission'); no modifica puntajes.
export function Results() {
  const { state, dispatch } = useSession()
  const ranking = rankTeams(state.teams)
  const winners = ranking.filter((entry) => entry.position === 1)
  const noPoints = state.teams.every((team) => team.score === 0)
  const isIntermission = state.phase === 'intermission'
  const isChallenge = state.mode?.kind === 'challenge'
  const finishedGame = isChallenge ? getGame(CHALLENGE_ORDER[state.gameIndex]) : null
  const nextGame = isIntermission ? getGame(CHALLENGE_ORDER[state.gameIndex + 1]) : null

  let label = 'Resultados'
  if (state.mode?.kind === 'single') label = `Resultados · ${getGame(state.mode.game).title}`
  else if (isIntermission) label = `Desafío completo · Juego ${state.gameIndex + 1} de ${CHALLENGE_ORDER.length}`
  else if (isChallenge) label = 'Resultados · Desafío completo'

  let title: string
  if (isIntermission) title = `¡Terminó ${finishedGame?.title}!`
  else if (noPoints) title = 'Sin puntos en esta partida'
  else if (winners.length > 1) title = '¡Empate en el primer puesto!'
  else title = `¡Ganó ${winners[0].team.name}!`

  return (
    <AppShell
      aside={isIntermission && <ExitToMenuButton />}
    >
      <section className="text-center">
        <p className="text-accent-2 text-2xl font-bold uppercase">{label}</p>
        <h1 className="font-display mt-2 text-6xl uppercase">{title}</h1>
        {isIntermission && <p className="text-muted mt-3 text-2xl font-semibold">Puntajes acumulados</p>}
      </section>

      <ol className="mx-auto mt-[4vh] grid w-full max-w-4xl gap-4">
        {ranking.map(({ team, position }) => {
          const index = state.teams.indexOf(team)
          return (
            <li
              key={team.id}
              className="bg-surface flex items-center gap-6 rounded-3xl px-8 py-5"
              style={{ boxShadow: `inset 0.6rem 0 0 ${teamColor(index)}` }}
            >
              <span className="font-display text-muted w-16 text-4xl">{position}°</span>
              <span className="flex-1 truncate text-3xl font-extrabold" style={{ color: teamColor(index) }}>
                {team.name}
              </span>
              <span className="font-display text-5xl tabular-nums">{team.score}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-auto flex justify-center pt-[4vh]">
        {isIntermission && nextGame ? (
          <Button className="px-12 py-5 text-3xl" onClick={() => dispatch({ type: 'nextGame' })}>
            Siguiente: {nextGame.icon} {nextGame.title} →
          </Button>
        ) : (
          <Button onClick={() => dispatch({ type: 'backToMenu' })}>Volver al menú</Button>
        )}
      </div>
    </AppShell>
  )
}
