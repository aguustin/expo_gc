import { brand } from '../brand.ts'
import { AppShell } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { ChallengeProgress } from '../components/ChallengeProgress.tsx'
import { ExitToMenuButton } from '../components/ExitToMenuButton.tsx'
import { GAME_ICONS } from '../components/gameIcons.ts'
import { Icon } from '../components/Icon.tsx'
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
    <AppShell aside={isIntermission && <ExitToMenuButton />}>
      <section className="rise-in flex flex-col items-center text-center">
        {isChallenge && <ChallengeProgress gameIndex={state.gameIndex} currentDone />}
        <p className="text-accent mt-4 text-2xl font-extrabold tracking-wide uppercase">{label}</p>
        <h1 className="font-display text-ink mt-1 text-6xl font-extrabold tracking-tight">{title}</h1>
        {isIntermission && <p className="text-ink-2 mt-2 text-2xl font-semibold">Puntajes acumulados</p>}
      </section>

      <ol className="mx-auto mt-[2.5vh] grid w-full max-w-4xl gap-3">
        {ranking.map(({ team, position }) => {
          const index = state.teams.indexOf(team)
          const isLeader = position === 1 && !noPoints
          return (
            <li
              key={team.id}
              className={`rise-in flex items-center gap-6 rounded-[var(--radius-panel)] border bg-white px-7 ${
                isLeader
                  ? 'border-accent-line py-4 shadow-[0_0_0_3px_var(--color-accent-soft),var(--shadow-elev-3)]'
                  : 'border-line py-3 shadow-[var(--shadow-elev-1)]'
              }`}
            >
              <span
                className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl font-extrabold ${
                  isLeader ? 'bg-accent text-white shadow-[0_3px_0_var(--color-accent-deep)]' : 'bg-surface-3 text-ink-2'
                }`}
              >
                {isLeader ? <Icon name="trophy" className="h-8 w-8" /> : `${position}°`}
              </span>
              <span className="h-10 w-2 shrink-0 rounded-full" style={{ backgroundColor: teamColor(index) }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-3xl font-bold" style={{ color: teamColor(index) }}>
                {isLeader && <span className="sr-only">{position}° </span>}
                {team.name}
              </span>
              <span className="font-display text-ink text-5xl font-extrabold tabular-nums">{team.score}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-auto flex items-center justify-between gap-6 pt-[2.5vh]">
        <span className="surface-raised inline-flex h-14 items-center rounded-2xl px-4 py-2">
          <img src={brand.venueLogo} alt={`Sede: ${brand.venueName}`} className="h-full w-auto object-contain mix-blend-multiply" draggable={false} />
        </span>
        {isIntermission && nextGame ? (
          <Button size="xl" onClick={() => dispatch({ type: 'nextGame' })}>
            Siguiente:
            <Icon name={GAME_ICONS[nextGame.id]} className="h-9 w-9" />
            {nextGame.title}
            <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
          </Button>
        ) : (
          <Button size="lg" onClick={() => dispatch({ type: 'backToMenu' })}>
            <Icon name="home" className="h-7 w-7" />
            Volver al menú
          </Button>
        )}
        <span className="w-[12rem]" aria-hidden="true" />
      </div>
    </AppShell>
  )
}
