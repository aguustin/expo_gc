import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
import { teamColor } from '../../components/teamColor.ts'
import { gameProgressKey, loadGameProgress, persistGameProgress } from '../../state/persistence.ts'
import { useSession } from '../../state/SessionContext.tsx'
import {
  ANSWER_TIME_MS,
  createLocationState,
  distanceMeters,
  locationStep,
  photoOptions,
  POINTS_PER_CORRECT_ANSWER,
  variantUnavailableReason,
  type GeoPoint,
  type LocationEvent,
  type LocationState,
  type LocationVariant,
} from './locationLogic.ts'
import { LocationMap } from './LocationMap.tsx'
import { PLACES } from './locations.ts'
import { serializeLocation } from './locationSnapshot.ts'
import { MAP_DATA } from './mapData.ts'
import { formatDistance } from './mapProjection.ts'

const OPTION_LETTERS = ['A', 'B', 'C', 'D']
const PHOTO_QUESTION = '¿Qué lugar aparece en la foto?'

function unavailableReason(variant: LocationVariant): string | null {
  if (variant === 'map' && !MAP_DATA) return 'Falta o está dañado el mapa local (src/data/godoy-cruz-map.json).'
  return variantUnavailableReason(PLACES, variant)
}

export function LocationGame() {
  const { state: session, dispatch } = useSession()
  const progressKey = gameProgressKey(session)
  // Tras una recarga se retoma el progreso guardado (ya validado); si no hay, empieza de cero.
  const [game, setGame] = useState<LocationState>(
    () =>
      loadGameProgress<LocationState>(progressKey, 'location', session.teams.map((team) => team.id)) ??
      createLocationState(PLACES),
  )
  // Mismo patrón que la ruleta: el ref se actualiza en el acto, así un clic y el vencimiento
  // del tiempo en el mismo instante no pueden resolver la ubicación dos veces.
  const gameRef = useRef(game)
  const [now, setNow] = useState(() => Date.now())
  const [failedImage, setFailedImage] = useState<string | null>(null)
  // Cada reintento pide la imagen con otra URL para evitar la copia fallida en caché.
  const [imageAttempt, setImageAttempt] = useState(0)
  // Punto marcado en el mapa y todavía no confirmado (solo vale para la ubicación en curso).
  const [pending, setPending] = useState<{ placeId: string; point: GeoPoint } | null>(null)

  const send = useCallback(
    (event: LocationEvent) => {
      const { state: next, effects } = locationStep(gameRef.current, event)
      if (next === gameRef.current) return
      gameRef.current = next
      setGame(next)
      effects.forEach(dispatch)
    },
    [dispatch],
  )

  useEffect(() => {
    if (progressKey) persistGameProgress(progressKey, serializeLocation(game))
  }, [game, progressKey])

  // Temporizador: solo corre mientras se responde; el cleanup lo detiene al resolver, reiniciar o salir.
  const activeTeamId = session.activeTeamId
  useEffect(() => {
    if (game.phase !== 'answering' || game.deadline === null) return
    const { deadline, gameId } = game
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= deadline) send({ type: 'timeout', gameId, teamId: activeTeamId, now: t })
    }, 200)
    return () => clearInterval(id)
  }, [game, activeTeamId, send])

  function showNext() {
    const t = Date.now()
    setNow(t)
    send({ type: 'show', random: Math.random(), now: t })
  }

  // Reinicia solo este juego, con la misma modalidad: los puntos de la sesión se conservan.
  function restart() {
    const next = createLocationState(PLACES, gameRef.current.gameId + 1, gameRef.current.variant)
    gameRef.current = next
    setGame(next)
    setPending(null)
  }

  const teamIndex = (id: string | null) => session.teams.findIndex((team) => team.id === id)
  const activeIndex = teamIndex(activeTeamId)
  const activeTeam = session.teams[activeIndex]

  if (game.total === 0) {
    return (
      <GameDataError
        message="No se puede jugar ¿Dónde queda?"
        detail="No hay lugares válidos en el catálogo (src/data/locations.json). Revisá el archivo y volvé a cargar la aplicación."
      />
    )
  }
  if (game.variant === 'map' && !MAP_DATA) {
    return (
      <GameDataError
        message="No se puede mostrar el mapa"
        detail="Falta o está dañado el mapa local (src/data/godoy-cruz-map.json). Generalo con scripts/build-map.mjs y volvé a cargar la aplicación."
      />
    )
  }

  const { current } = game
  const questionVisible = current !== null && (game.phase === 'answering' || game.phase === 'revealed')
  const locationNumber = game.phase === 'revealed' ? game.resolvedCount : game.resolvedCount + 1
  const totalSeconds = ANSWER_TIME_MS / 1000
  // `now` deja de actualizarse al resolver, así que el tiempo queda congelado.
  const secondsLeft =
    game.deadline === null
      ? totalSeconds
      : game.outcome === 'timeout'
        ? 0
        : Math.max(0, Math.ceil((game.deadline - now) / 1000))
  const timerColor =
    secondsLeft <= 5 ? 'var(--color-accent)' : secondsLeft <= 10 ? 'var(--color-accent-2)' : 'var(--color-accent-3)'
  const isLast = game.resolvedCount >= game.total || game.usedIds.length >= game.places.length
  const answeredByName = session.teams[teamIndex(game.answeredBy)]?.name ?? ''
  const distance = current && game.selectedPoint ? distanceMeters(game.selectedPoint, current) : null
  const options = current && game.variant === 'photo' ? photoOptions(current, game.places) : null
  const pendingPoint = pending && current && pending.placeId === current.id ? pending.point : null
  // Con nombres largos (p. ej. «Centro Patrimonial y Artístico Cristoforo Colombo») se achica la letra
  // de las opciones para que las cuatro entren sin desbordar.
  const optionText = options?.options.some((option) => option.length > 28) ? 'text-2xl' : 'text-3xl'

  const continueButton = (
    <Button className="px-10 py-5 text-3xl shadow-[0_0.5rem_1.5rem_rgb(0_0_0/0.5)]" onClick={() => send({ type: 'continue' })}>
      {isLast ? 'Ver resultados' : 'Siguiente lugar →'}
    </Button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Barra de estado a todo el ancho: turno, temporizador o resultado, progreso y reinicio. */}
      <div className="flex items-center gap-5">
        <p className="max-w-[28%] shrink-0 truncate text-2xl font-bold">
          <span className="text-muted">Juega </span>
          <span style={{ color: teamColor(activeIndex) }}>{activeTeam?.name}</span>
        </p>
        <div className="flex h-14 min-w-0 flex-1 items-center">
          {game.phase === 'revealed' && current ? (
            <Feedback
              outcome={game.outcome}
              teamName={answeredByName}
              detail={
                game.variant === 'photo'
                  ? `Era la ${OPTION_LETTERS[options?.correctOption ?? 0]}`
                  : game.outcome !== 'timeout' && distance !== null
                    ? `A ${formatDistance(distance)} del lugar`
                    : ''
              }
            />
          ) : game.phase === 'answering' ? (
            <div className="flex flex-1 items-center gap-5">
              <div className="bg-night/60 h-5 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-[width] duration-200 ease-linear"
                  style={{ width: `${(secondsLeft / totalSeconds) * 100}%`, backgroundColor: timerColor }}
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
          ) : null}
        </div>
        {game.phase !== 'choosing' && (
          <p className="bg-night/60 shrink-0 rounded-full px-5 py-1 text-2xl font-extrabold tabular-nums">
            Lugar {locationNumber} de {game.total}
          </p>
        )}
        <Button variant="secondary" className="shrink-0 px-5 py-3 text-lg" onClick={restart}>
          ↻ Reiniciar juego
        </Button>
      </div>

      {game.phase === 'choosing' ? (
        <VariantChooser onChoose={(variant) => send({ type: 'choose', variant })} />
      ) : game.variant === 'map' && MAP_DATA ? (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-[2vw]">
          {/* Fila de altura fija: el panel nunca agranda el mapa (un cambio de tamaño reiniciaría la vista). */}
          <div className="relative min-h-0">
            <LocationMap
              // Un mapa nuevo por lugar: cada ronda empieza con la vista completa.
              key={current?.id ?? 'sin-lugar'}
              map={MAP_DATA}
              focusPoints={game.places}
              interactive={game.phase === 'answering'}
              pending={pendingPoint}
              onPick={(point) => current && setPending({ placeId: current.id, point })}
              reveal={
                game.phase === 'revealed' && current && game.outcome
                  ? { target: current, selected: game.selectedPoint, outcome: game.outcome, distance }
                  : null
              }
              markerColor={teamColor(teamIndex(game.answeredBy ?? activeTeamId))}
            />
          </div>
          <div className="bg-surface/70 flex min-h-0 flex-col overflow-hidden rounded-[2rem] p-6">
            {questionVisible && current ? (
              <>
                <p className="text-muted text-2xl font-bold uppercase">Ubicá en el mapa</p>
                <h2 className={`font-display mt-2 leading-tight ${current.name.length > 30 ? 'text-3xl' : 'text-4xl'}`}>
                  {current.name}
                </h2>
                {game.phase === 'answering' ? (
                  <>
                    <p className="text-muted mt-4 text-2xl font-semibold">
                      Acercá con + y −, arrastrá para moverte y tocá para marcar.
                    </p>
                    <Button
                      className="mt-auto w-full py-5 text-3xl"
                      disabled={!pendingPoint}
                      onClick={() =>
                        pendingPoint && send({ type: 'answerPoint', point: pendingPoint, teamId: activeTeamId, now: Date.now() })
                      }
                    >
                      Confirmar ubicación
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="mt-4 text-2xl font-semibold">{current.address}</p>
                    <div className="mt-auto">{continueButton}</div>
                  </>
                )}
              </>
            ) : (
              <ReadyPanel teamName={activeTeam?.name} color={teamColor(activeIndex)} onShow={showNext} disabled={game.phase !== 'ready'} />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-[2vw]">
          <figure className="bg-night/60 relative m-0 min-h-0 overflow-hidden rounded-[2rem] ring-4 ring-white/10">
            {questionVisible && current?.image && failedImage !== current.image ? (
              <img
                key={current.id}
                src={imageAttempt === 0 ? current.image : `${current.image}?intento=${imageAttempt}`}
                alt="Fotografía del lugar"
                className="absolute inset-0 h-full w-full object-contain"
                onError={() => setFailedImage(current.image)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                <span className="text-9xl" aria-hidden="true">
                  📍
                </span>
                <p className="text-muted text-3xl font-bold">
                  {questionVisible ? 'La imagen no se pudo cargar' : `Lugar ${locationNumber} de ${game.total}`}
                </p>
                {questionVisible && (
                  <Button
                    variant="secondary"
                    className="text-2xl"
                    onClick={() => {
                      setFailedImage(null)
                      setImageAttempt((attempt) => attempt + 1)
                    }}
                  >
                    Reintentar imagen
                  </Button>
                )}
              </div>
            )}
            {game.phase === 'revealed' && <div className="absolute right-6 bottom-6">{continueButton}</div>}
          </figure>

          <div className="bg-surface/70 flex min-h-0 flex-col rounded-[2rem] p-6">
            {questionVisible && current && options ? (
              <>
                <h2 className="text-2xl leading-tight font-extrabold">{PHOTO_QUESTION}</h2>
                <div className="mt-4 grid gap-3">
                  {options.options.map((option, index) => {
                    const revealed = game.phase === 'revealed'
                    let style = 'bg-surface-strong ring-white/15 hover:bg-white/15'
                    if (revealed && index === options.correctOption) style = 'bg-accent-3 text-night ring-accent-3'
                    else if (revealed && index === game.selectedOption) style = 'bg-accent text-white ring-accent'
                    else if (revealed) style = 'bg-surface-strong ring-transparent opacity-40'
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={game.phase !== 'answering'}
                        onClick={() => send({ type: 'answer', option: index, teamId: activeTeamId, now: Date.now() })}
                        className={`flex items-center gap-4 rounded-2xl px-5 py-2 text-left ${optionText} font-bold ring-4 transition disabled:cursor-default ${style}`}
                      >
                        <span className="font-display bg-night/30 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl">
                          {OPTION_LETTERS[index]}
                        </span>
                        <span className="min-w-0 leading-tight">{option}</span>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <ReadyPanel teamName={activeTeam?.name} color={teamColor(activeIndex)} onShow={showNext} disabled={game.phase !== 'ready'} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function VariantChooser({ onChoose }: { onChoose: (variant: LocationVariant) => void }) {
  const variants: { id: LocationVariant; icon: string; title: string; description: string }[] = [
    { id: 'photo', icon: '📷', title: 'Reconocé el lugar', description: 'Mirá la foto y elegí entre cuatro opciones.' },
    { id: 'map', icon: '🗺️', title: 'Ubicá el lugar', description: 'Marcá en el mapa dónde queda el lugar.' },
  ]
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      <p className="font-display text-center text-3xl uppercase">Elegí la modalidad</p>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-[2vw]">
        {variants.map((variant) => {
          const reason = unavailableReason(variant.id)
          return (
            <button
              key={variant.id}
              type="button"
              disabled={reason !== null}
              onClick={() => onChoose(variant.id)}
              className="bg-surface enabled:hover:ring-accent-2 flex min-h-0 flex-col items-center justify-center gap-3 rounded-[2rem] p-6 text-center ring-4 ring-white/10 transition enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-7xl" aria-hidden="true">
                {variant.icon}
              </span>
              <span className="font-display text-accent-2 text-4xl uppercase">{variant.title}</span>
              <span className="text-muted text-2xl font-semibold">{variant.description}</span>
              {reason && (
                <span className="bg-night/70 text-ink mt-2 rounded-2xl px-5 py-2 text-xl font-bold">No disponible: {reason}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type ReadyPanelProps = { teamName: string | undefined; color: string; onShow: () => void; disabled: boolean }

function ReadyPanel({ teamName, color, onShow, disabled }: ReadyPanelProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
      <p className="font-display max-w-full truncate text-5xl uppercase" style={{ color }}>
        {teamName}
      </p>
      <p className="text-muted text-2xl font-semibold">Cada respuesta correcta vale {POINTS_PER_CORRECT_ANSWER} puntos.</p>
      <Button className="px-12 py-5 text-3xl" onClick={onShow} disabled={disabled}>
        Mostrar lugar
      </Button>
    </div>
  )
}

type FeedbackProps = {
  outcome: LocationState['outcome']
  teamName: string
  detail: string
}

// Ocupa el lugar del temporizador una vez resuelta la ubicación.
function Feedback({ outcome, teamName, detail }: FeedbackProps) {
  const [text, color] =
    outcome === 'correct'
      ? [`¡Correcto! +${POINTS_PER_CORRECT_ANSWER} para ${teamName}`, 'bg-accent-3 text-night']
      : outcome === 'timeout'
        ? [`¡Tiempo agotado! ${detail}`.trim(), 'bg-accent-2 text-night']
        : [`Incorrecto. ${detail}`, 'bg-accent text-white']
  return (
    <p className={`flex h-14 w-full items-center rounded-2xl px-6 text-2xl font-black ${color}`} role="status">
      <span className="truncate">{text}</span>
    </p>
  )
}
