import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
import { AnswerOption, InfoPill, PanelLabel, StatusBanner, TimerBar, type AnswerState } from '../../components/GameUI.tsx'
import { Icon, type IconName } from '../../components/Icon.tsx'
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
  const isLast = game.resolvedCount >= game.total || game.usedIds.length >= game.places.length
  const answeredByName = session.teams[teamIndex(game.answeredBy)]?.name ?? ''
  const distance = current && game.selectedPoint ? distanceMeters(game.selectedPoint, current) : null
  const options = current && game.variant === 'photo' ? photoOptions(current, game.places) : null
  const pendingPoint = pending && current && pending.placeId === current.id ? pending.point : null
  // Con nombres largos (p. ej. «Centro Patrimonial y Artístico Cristoforo Colombo») se achica la letra
  // de las opciones para que las cuatro entren sin desbordar.
  const optionText = options?.options.some((option) => option.length > 28) ? 'text-2xl' : 'text-3xl'
  const detail =
    game.variant === 'photo'
      ? `Era la ${OPTION_LETTERS[options?.correctOption ?? 0]}`
      : game.outcome !== 'timeout' && distance !== null
        ? `A ${formatDistance(distance)} del lugar`
        : ''

  const continueButton = (size: 'lg' | 'xl', className = '') => (
    <Button size={size} className={className} onClick={() => send({ type: 'continue' })}>
      {isLast ? 'Ver resultados' : 'Siguiente lugar'}
      <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
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
            <StatusBanner tone={game.outcome === 'correct' ? 'success' : game.outcome === 'timeout' ? 'warning' : 'danger'}>
              {game.outcome === 'correct'
                ? `¡Correcto! +${POINTS_PER_CORRECT_ANSWER} para ${answeredByName}`
                : game.outcome === 'timeout'
                  ? `¡Tiempo agotado! ${detail}`.trim()
                  : `Incorrecto. ${detail}`}
            </StatusBanner>
          ) : game.phase === 'answering' ? (
            <TimerBar secondsLeft={secondsLeft} totalSeconds={totalSeconds} />
          ) : null}
        </div>
        {game.phase !== 'choosing' && (
          <InfoPill>
            Lugar {locationNumber} de {game.total}
          </InfoPill>
        )}
        <Button variant="secondary" className="shrink-0" onClick={restart}>
          <Icon name="refresh" className="h-6 w-6" />
          Reiniciar juego
        </Button>
      </div>

      {game.phase === 'choosing' ? (
        <VariantChooser onChoose={(variant) => send({ type: 'choose', variant })} />
      ) : game.variant === 'map' && MAP_DATA ? (
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-[2vw]">
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
          <div className="surface-raised flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] p-6">
            {questionVisible && current ? (
              <>
                <PanelLabel>Ubicá en el mapa</PanelLabel>
                <h2
                  className={`font-display text-ink mt-2 leading-tight font-extrabold tracking-tight ${current.name.length > 30 ? 'text-3xl' : 'text-4xl'}`}
                >
                  {current.name}
                </h2>
                {game.phase === 'answering' ? (
                  <>
                    <ul className="text-ink-2 mt-5 grid min-h-0 shrink content-start gap-3 overflow-hidden text-xl font-semibold">
                      <li className="flex items-center gap-3">
                        <Icon name="plus" className="text-accent h-7 w-7" strokeWidth={2.5} />
                        Acercá con + y −
                      </li>
                      <li className="flex items-center gap-3">
                        <Icon name="hand" className="text-accent h-7 w-7" />
                        Arrastrá para moverte
                      </li>
                      <li className="flex items-center gap-3">
                        <Icon name="target" className="text-accent h-7 w-7" />
                        Tocá para marcar
                      </li>
                    </ul>
                    <p
                      className={`mt-4 flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-lg font-bold ${
                        pendingPoint ? 'bg-accent-soft text-accent-strong' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      <Icon name={pendingPoint ? 'check' : 'pin'} className="h-6 w-6" strokeWidth={2.5} />
                      {pendingPoint ? 'Marca puesta' : 'Todavía no marcaste'}
                    </p>
                    <Button
                      size="lg"
                      className="mt-auto w-full shrink-0"
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
                    <p className="text-ink-2 mt-4 flex gap-3 text-2xl font-semibold">
                      <Icon name="pin" className="text-accent mt-1 h-7 w-7" />
                      {current.address}
                    </p>
                    <div className="mt-auto shrink-0">{continueButton('lg', 'w-full')}</div>
                  </>
                )}
              </>
            ) : (
              <ReadyPanel teamName={activeTeam?.name} color={teamColor(activeIndex)} onShow={showNext} disabled={game.phase !== 'ready'} />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-[2vw]">
          {/* Foto sobre un passepartout blanco elevado. */}
          <figure className="surface-raised relative m-0 min-h-0 overflow-hidden rounded-[var(--radius-panel)] p-3">
            <div className="bg-surface-3 relative h-full w-full overflow-hidden rounded-[1.1rem]">
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
                  <span className="text-accent grid h-28 w-28 place-items-center rounded-full bg-white shadow-[var(--shadow-elev-2)]">
                    <Icon name={questionVisible ? 'alert' : 'camera'} className="h-14 w-14" />
                  </span>
                  <p className="text-ink-2 text-3xl font-bold">
                    {questionVisible ? 'La imagen no se pudo cargar' : `Lugar ${locationNumber} de ${game.total}`}
                  </p>
                  {questionVisible && (
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={() => {
                        setFailedImage(null)
                        setImageAttempt((attempt) => attempt + 1)
                      }}
                    >
                      <Icon name="refresh" className="h-7 w-7" />
                      Reintentar imagen
                    </Button>
                  )}
                </div>
              )}
            </div>
            {game.phase === 'revealed' && <div className="absolute right-7 bottom-7">{continueButton('xl')}</div>}
          </figure>

          <div className="surface-raised flex min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel)] p-6">
            {questionVisible && current && options ? (
              <>
                <PanelLabel>Reconocé el lugar</PanelLabel>
                <h2 className="font-display text-ink mt-1 text-3xl leading-tight font-extrabold tracking-tight">{PHOTO_QUESTION}</h2>
                <div className="mt-4 grid gap-3">
                  {options.options.map((option, index) => {
                    const revealed = game.phase === 'revealed'
                    const state: AnswerState = !revealed
                      ? 'idle'
                      : index === options.correctOption
                        ? 'correct'
                        : index === game.selectedOption
                          ? 'wrong'
                          : 'dimmed'
                    return (
                      <AnswerOption
                        key={index}
                        letter={OPTION_LETTERS[index]}
                        state={state}
                        disabled={game.phase !== 'answering'}
                        textClassName={optionText}
                        onClick={() => send({ type: 'answer', option: index, teamId: activeTeamId, now: Date.now() })}
                      >
                        {option}
                      </AnswerOption>
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
  const variants: { id: LocationVariant; icon: IconName; title: string; description: string }[] = [
    { id: 'photo', icon: 'camera', title: 'Reconocé el lugar', description: 'Mirá la foto y elegí entre cuatro opciones.' },
    { id: 'map', icon: 'map', title: 'Ubicá el lugar', description: 'Marcá en el mapa dónde queda el lugar.' },
  ]
  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <p className="font-display text-ink text-center text-3xl font-extrabold tracking-tight">Elegí la modalidad</p>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-[2vw]">
        {variants.map((variant) => {
          const reason = unavailableReason(variant.id)
          return (
            <button
              key={variant.id}
              type="button"
              disabled={reason !== null}
              onClick={() => onChoose(variant.id)}
              className="surface-raised tilt-card group flex min-h-0 flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] p-6 text-center disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span className="bg-accent-soft text-accent grid h-24 w-24 place-items-center rounded-3xl shadow-[inset_0_-4px_0_var(--color-accent-line)]">
                <Icon name={variant.icon} className="h-14 w-14" />
              </span>
              <span className="font-display text-ink text-4xl font-extrabold tracking-tight">{variant.title}</span>
              <span className="text-ink-2 text-2xl font-medium">{variant.description}</span>
              {reason ? (
                <span className="bg-danger-soft text-danger mt-2 flex items-center gap-2 rounded-xl px-5 py-2 text-xl font-bold">
                  <Icon name="alert" className="h-6 w-6" />
                  No disponible: {reason}
                </span>
              ) : (
                <span className="text-accent mt-2 flex items-center gap-2 text-2xl font-extrabold">
                  Elegir
                  <Icon name="arrowRight" className="h-7 w-7 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
                </span>
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <PanelLabel>Le toca a</PanelLabel>
      <p className="font-display max-w-full truncate text-5xl font-extrabold tracking-tight" style={{ color }}>
        {teamName}
      </p>
      <p className="text-ink-2 text-2xl font-medium">Cada respuesta correcta vale {POINTS_PER_CORRECT_ANSWER} puntos.</p>
      <Button size="xl" onClick={onShow} disabled={disabled}>
        Mostrar lugar
        <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
      </Button>
    </div>
  )
}
