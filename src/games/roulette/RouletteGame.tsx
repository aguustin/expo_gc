import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
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
  const timeRatio = secondsLeft / totalSeconds
  const timerColor =
    secondsLeft <= 5 ? 'var(--color-accent)' : secondsLeft <= 10 ? 'var(--color-accent-2)' : 'var(--color-accent-3)'
  const isLast = game.resolvedCount >= game.total || segments.length <= 1

  return (
    <div className="grid flex-1 grid-cols-[auto_1fr] items-center gap-[3vw]">
      <div className="flex flex-col items-center gap-6">
        <div className="h-[min(46vh,32vw)]">
          <Wheel labels={labels} rotation={rotation} spinning={game.phase === 'spinning'} durationMs={SPIN_DURATION_MS} />
        </div>
        {/* El mismo lugar sirve para girar y, con la pregunta resuelta, para continuar. */}
        {game.phase === 'revealed' ? (
          <Button className="px-10 py-5 text-3xl" onClick={() => send({ type: 'continue' })}>
            {isLast ? 'Ver resultados' : 'Siguiente pregunta →'}
          </Button>
        ) : (
          <Button className="px-14 py-5 text-3xl uppercase" onClick={handleSpin} disabled={game.phase !== 'idle'}>
            {game.phase === 'spinning' ? 'Girando…' : '¡Girar!'}
          </Button>
        )}
      </div>

      <div className="bg-surface/70 flex h-full flex-col rounded-[2rem] p-8">
        <div className="flex items-center justify-between gap-6">
          <p className="text-2xl font-bold">
            <span className="text-muted">Turno de </span>
            <span style={{ color: teamColor(activeIndex) }}>{activeTeam?.name}</span>
          </p>
          <p className="bg-night/60 rounded-full px-5 py-1 text-2xl font-extrabold tabular-nums">
            Pregunta {questionNumber} de {game.total}
          </p>
        </div>

        {game.current && (game.phase === 'answering' || game.phase === 'revealed') ? (
          <>
            {game.phase === 'revealed' ? (
              <Feedback
                outcome={game.outcome}
                teamName={session.teams[teamIndex(game.answeredBy)]?.name ?? ''}
                correctLetter={OPTION_LETTERS[game.current.correctOption]}
              />
            ) : (
              <div className="mt-4 flex h-16 items-center gap-5">
                <div className="bg-night/60 h-5 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-linear"
                    style={{ width: `${timeRatio * 100}%`, backgroundColor: timerColor }}
                  />
                </div>
                <p
                  className="font-display w-28 text-right text-5xl tabular-nums"
                  style={{ color: timerColor }}
                  aria-label={`${secondsLeft} segundos restantes`}
                >
                  {secondsLeft}s
                </p>
              </div>
            )}

            <h2
              className={`mt-4 leading-tight font-extrabold ${game.current.question.length > 90 ? 'text-3xl' : 'text-4xl'}`}
            >
              {game.current.question}
            </h2>

            <div className="mt-5 grid grid-cols-2 gap-4">
              {game.current.options.map((option, index) => {
                const revealed = game.phase === 'revealed'
                const isCorrect = index === game.current?.correctOption
                const isSelected = index === game.selectedOption
                let style = 'bg-surface-strong ring-white/15 hover:bg-white/15'
                if (revealed && isCorrect) style = 'bg-accent-3 text-night ring-accent-3'
                else if (revealed && isSelected) style = 'bg-accent text-white ring-accent'
                else if (revealed) style = 'bg-surface-strong ring-transparent opacity-40'
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={game.phase !== 'answering'}
                    onClick={() => send({ type: 'answer', option: index, teamId: activeTeamId, now: Date.now() })}
                    className={`flex items-center gap-4 rounded-2xl px-6 py-3 text-left text-3xl font-bold ring-4 transition disabled:cursor-default ${style}`}
                  >
                    <span className="font-display bg-night/30 grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl">
                      {OPTION_LETTERS[index]}
                    </span>
                    {option}
                  </button>
                )
              })}
            </div>

          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="font-display text-6xl uppercase" style={{ color: teamColor(activeIndex) }}>
              {activeTeam?.name}
            </p>
            <p className="text-muted mt-4 text-3xl font-semibold">
              {game.phase === 'spinning'
                ? 'Sorteando la pregunta…'
                : `Girá la ruleta. Cada respuesta correcta vale ${POINTS_PER_CORRECT_ANSWER} puntos.`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

type FeedbackProps = {
  outcome: RouletteState['outcome']
  teamName: string
  correctLetter: string
}

// Ocupa el lugar del temporizador una vez resuelta la pregunta; la opción correcta queda resaltada en verde.
function Feedback({ outcome, teamName, correctLetter }: FeedbackProps) {
  const [text, color] =
    outcome === 'correct'
      ? [`¡Correcto! +${POINTS_PER_CORRECT_ANSWER} para ${teamName}`, 'bg-accent-3 text-night']
      : outcome === 'timeout'
        ? [`¡Se acabó el tiempo! Era la ${correctLetter}`, 'bg-accent-2 text-night']
        : [`Incorrecto. Era la ${correctLetter}`, 'bg-accent text-white']
  return (
    <p className={`mt-4 flex h-16 items-center truncate rounded-2xl px-6 text-3xl font-black ${color}`} role="status">
      {text}
    </p>
  )
}
