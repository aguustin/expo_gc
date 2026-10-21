import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
import { AnswerOption, InfoPill, PanelLabel, StatusBanner, TimerBar, type AnswerState } from '../../components/GameUI.tsx'
import { Icon } from '../../components/Icon.tsx'
import { teamColor } from '../../components/teamColor.ts'
import { gameProgressKey, loadGameProgress, persistGameProgress } from '../../state/persistence.ts'
import { useSession } from '../../state/SessionContext.tsx'
import { ROULETTE_QUESTIONS } from './questions.ts'
import {
  ANSWER_TIME_MS,
  createRouletteState,
  POINTS_PER_CORRECT_ANSWER,
  rouletteStep,
  wheelQuestions,
  type RouletteEvent,
  type RouletteState,
} from './rouletteLogic.ts'
import { serializeRoulette } from './rouletteSnapshot.ts'
import { Wheel } from './Wheel.tsx'

const SPIN_DURATION_MS = 4000
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function targetRotation(current: number, index: number, count: number) {
  const slice = 360 / count
  const center = (index + 0.5) * slice + (Math.random() - 0.5) * slice * 0.6
  const delta = (((360 - center - current) % 360) + 360) % 360
  return current + 5 * 360 + delta
}

export function RouletteGame() {
  const { state: session, dispatch } = useSession()
  const progressKey = gameProgressKey(session)
  // Tras una recarga se retoma el progreso guardado (ya validado); si no hay, empieza de cero.
  const [game, setGame] = useState<RouletteState>(
    () =>
      loadGameProgress<RouletteState>(progressKey, 'roulette', session.teams.map((team) => team.id)) ??
      createRouletteState(ROULETTE_QUESTIONS),
  )
  // El ref se actualiza en el acto: dos eventos en el mismo instante (doble clic, clic + fin del tiempo)
  // ven el estado ya resuelto y el segundo no tiene efecto.
  const gameRef = useRef(game)
  const [rotation, setRotation] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const send = useCallback(
    (event: RouletteEvent) => {
      const { state: next, effects } = rouletteStep(gameRef.current, event)
      if (next === gameRef.current) return next
      gameRef.current = next
      setGame(next)
      effects.forEach(dispatch)
      return next
    },
    [dispatch],
  )

  useEffect(() => {
    if (progressKey) persistGameProgress(progressKey, serializeRoulette(game))
  }, [game, progressKey])

  // Fin de la animación de giro. El cleanup evita timers vivos si se sale de la pantalla.
  useEffect(() => {
    if (game.phase !== 'spinning') return
    const id = setTimeout(() => {
      const t = Date.now()
      setNow(t)
      send({ type: 'spinEnd', now: t })
    }, SPIN_DURATION_MS)
    return () => clearTimeout(id)
  }, [game.phase, send])

  // Temporizador de respuesta.
  const activeTeamId = session.activeTeamId
  useEffect(() => {
    if (game.phase !== 'answering' || game.deadline === null) return
    const deadline = game.deadline
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline) send({ type: 'timeout', teamId: activeTeamId, now: t })
    }, 200)
    return () => clearInterval(id)
  }, [game.phase, game.deadline, activeTeamId, send])

  function handleSpin() {
    const next = send({ type: 'spin', random: Math.random() })
    if (next.phase !== 'spinning' || !next.current) return
    const segments = wheelQuestions(next)
    const index = segments.findIndex((question) => question.id === next.current?.id)
    setRotation((current) => targetRotation(current, index, segments.length))
  }

  const teamIndex = (id: string | null) => session.teams.findIndex((team) => team.id === id)
  const activeIndex = teamIndex(activeTeamId)
  const activeTeam = session.teams[activeIndex]

  if (game.total === 0) {
    return (
      <GameDataError
        message="No se puede jugar la Ruleta"
        detail="No hay preguntas válidas en los datos (src/data/roulette.json). Revisá el archivo y volvé a cargar la aplicación."
      />
    )
  }

  const segments = wheelQuestions(game)
  const labels = segments.map((question) => String(game.pool.indexOf(question) + 1))
  const questionNumber = game.phase === 'revealed' ? game.resolvedCount : game.resolvedCount + 1
  // `now` deja de actualizarse al resolver la pregunta, así que el tiempo queda congelado.
  const totalSeconds = ANSWER_TIME_MS / 1000
  const secondsLeft =
    game.deadline === null
      ? totalSeconds
      : game.outcome === 'timeout'
        ? 0
        : Math.max(0, Math.ceil((game.deadline - now) / 1000))
  const isLast = game.resolvedCount >= game.total || segments.length <= 1
  const answeredByName = session.teams[teamIndex(game.answeredBy)]?.name ?? ''
  const showImage = game.phase === 'answering' || game.phase === 'revealed'

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-center gap-[2.5vw]">
      <div className="flex min-h-0 flex-col items-center gap-7">
        {/* Con la pregunta en pantalla, la imagen reemplaza a la ruleta (que ya la sorteó). */}
        {showImage && game.current?.image ? (
          <figure className="surface-raised rise-in m-0 aspect-[3/2] w-full max-h-[52vh] overflow-hidden rounded-[var(--radius-panel)] p-3">
            <img
              key={game.current.id}
              src={game.current.image}
              alt=""
              className="bg-surface-3 h-full w-full rounded-[1.1rem] object-contain"
              draggable={false}
            />
          </figure>
        ) : (
          <div className="h-[min(46vh,32vw)]">
            <Wheel labels={labels} rotation={rotation} spinning={game.phase === 'spinning'} durationMs={SPIN_DURATION_MS} />
          </div>
        )}
        {/* El mismo lugar sirve para girar y, con la pregunta resuelta, para continuar. */}
        {game.phase === 'revealed' ? (
          <Button size="xl" onClick={() => send({ type: 'continue' })}>
            {isLast ? 'Ver resultados' : 'Siguiente pregunta'}
            <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
          </Button>
        ) : (
          <Button size="xl" className="min-w-[16rem]" onClick={handleSpin} disabled={game.phase !== 'idle'}>
            <Icon name="refresh" className={`h-9 w-9 ${game.phase === 'spinning' ? 'animate-spin' : ''}`} strokeWidth={2.5} />
            {game.phase === 'spinning' ? 'Girando…' : '¡Girar!'}
          </Button>
        )}
      </div>

      <div data-panel className="surface-raised flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] px-8 py-6">
        {game.current && (game.phase === 'answering' || game.phase === 'revealed') ? (
          <>
            {/* Una sola fila: progreso + temporizador (o resultado). El turno ya se ve en el marcador. */}
            <div className="flex h-14 shrink-0 items-center gap-5">
              {/* Con el resultado a la vista, el aviso usa toda la fila para que entre el nombre del equipo. */}
              {game.phase !== 'revealed' && (
                <InfoPill>
                  Pregunta {questionNumber} de {game.total}
                </InfoPill>
              )}
              {game.phase === 'revealed' ? (
                <StatusBanner tone={game.outcome === 'correct' ? 'success' : game.outcome === 'timeout' ? 'warning' : 'danger'}>
                  {game.outcome === 'correct'
                    ? `¡Correcto! +${POINTS_PER_CORRECT_ANSWER} para ${answeredByName}`
                    : game.outcome === 'timeout'
                      ? `¡Se acabó el tiempo! Era la ${OPTION_LETTERS[game.current.correctOption]}`
                      : `Incorrecto. Era la ${OPTION_LETTERS[game.current.correctOption]}`}
                </StatusBanner>
              ) : (
                <TimerBar secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
              )}
            </div>

            <h2
              className="font-display text-ink mt-3 text-3xl leading-tight font-bold"
            >
              {game.current.question}
            </h2>

            <div className="mt-3 grid gap-2.5">
              {game.current.options.map((option, index) => {
                const revealed = game.phase === 'revealed'
                const state: AnswerState = !revealed
                  ? 'idle'
                  : index === game.current?.correctOption
                    ? 'correct'
                    : index === game.selectedOption
                      ? 'wrong'
                      : 'dimmed'
                return (
                  <AnswerOption
                    key={index}
                    letter={OPTION_LETTERS[index]}
                    state={state}
                    textClassName="text-2xl"
                    disabled={game.phase !== 'answering'}
                    onClick={() => send({ type: 'answer', option: index, teamId: activeTeamId, now: Date.now() })}
                  >
                    {option}
                  </AnswerOption>
                )
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-6">
              <InfoPill>
                Pregunta {questionNumber} de {game.total}
              </InfoPill>
            </div>
            <PanelLabel>{game.phase === 'spinning' ? 'Sorteando la pregunta…' : 'Le toca a'}</PanelLabel>
            <p className="font-display mt-2 text-6xl font-extrabold tracking-tight" style={{ color: teamColor(activeIndex) }}>
              {activeTeam?.name}
            </p>
            <p className="text-ink-2 mt-5 text-3xl font-medium">
              {game.phase === 'spinning'
                ? 'Mirá dónde se detiene la ruleta.'
                : `Girá la ruleta. Cada respuesta correcta vale ${POINTS_PER_CORRECT_ANSWER} puntos.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
