import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
import { InfoPill, StatusBanner, type StatusTone } from '../../components/GameUI.tsx'
import { Icon } from '../../components/Icon.tsx'
import { brand } from '../../brand.ts'
import { teamColor } from '../../components/teamColor.ts'
import { gameProgressKey, loadGameProgress, persistGameProgress } from '../../state/persistence.ts'
import { useSession } from '../../state/SessionContext.tsx'
import {
  createMemoryState,
  isFaceUp,
  memoryStep,
  MISMATCH_DELAY_MS,
  PAIRS_PER_GAME,
  POINTS_PER_PAIR,
  type MemoryEvent,
  type MemoryPair,
  type MemoryState,
} from './memoryLogic.ts'
import { serializeMemory } from './memorySnapshot.ts'
import { MEMORY_PAIRS } from './pairs.ts'

export function MemoryGame() {
  const { state: session, dispatch } = useSession()
  const progressKey = gameProgressKey(session)
  // Tras una recarga se retoma el tablero guardado (ya validado); si no hay, se mezcla uno nuevo.
  const [game, setGame] = useState<MemoryState>(
    () =>
      loadGameProgress<MemoryState>(progressKey, 'memory', session.teams.map((team) => team.id)) ??
      createMemoryState(MEMORY_PAIRS, Math.random),
  )
  // Mismo patrón que la ruleta: el ref se actualiza en el acto, así los clics rápidos
  // ven el estado ya actualizado y no pueden elegir una tercera carta ni puntuar dos veces.
  const gameRef = useRef(game)

  const send = useCallback(
    (event: MemoryEvent) => {
      const { state: next, effects } = memoryStep(gameRef.current, event)
      if (next === gameRef.current) return
      gameRef.current = next
      setGame(next)
      effects.forEach(dispatch)
    },
    [dispatch],
  )

  useEffect(() => {
    if (progressKey) persistGameProgress(progressKey, serializeMemory(game))
  }, [game, progressKey])

  // Ocultar cartas que no coinciden. El cleanup cancela el timer al salir o reiniciar,
  // y el boardId impide que afecte a otro tablero.
  useEffect(() => {
    if (game.phase !== 'mismatch') return
    const boardId = game.boardId
    const id = setTimeout(() => send({ type: 'hide', boardId }), MISMATCH_DELAY_MS)
    return () => clearTimeout(id)
  }, [game.phase, game.boardId, send])

  // Reinicia solo el tablero: los puntos de la sesión se conservan.
  function restartBoard() {
    const next = createMemoryState(MEMORY_PAIRS, Math.random, gameRef.current.boardId + 1)
    gameRef.current = next
    setGame(next)
  }

  const pairsById = new Map(game.pairs.map((pair) => [pair.id, pair]))
  const teamIndex = (id: string | null) => session.teams.findIndex((team) => team.id === id)
  const activeIndex = teamIndex(session.activeTeamId)
  const activeTeam = session.teams[activeIndex]

  // El tablero exige exactamente PAIRS_PER_GAME parejas: con menos no se puede jugar según las reglas.
  if (game.pairs.length < PAIRS_PER_GAME) {
    return (
      <GameDataError
        message="No se puede jugar Memoria"
        detail={`Hay ${game.pairs.length} parejas válidas y el tablero necesita ${PAIRS_PER_GAME} (src/data/memory.json). Revisá el archivo y volvé a cargar la aplicación.`}
      />
    )
  }

  let status: { text: string; tone: StatusTone }
  if (game.lastMatch) {
    const finder = session.teams[teamIndex(game.lastMatch.teamId)]?.name ?? ''
    status = {
      text: game.phase === 'complete' ? `¡Pareja! +${POINTS_PER_PAIR} para ${finder}` : `¡Pareja! +${POINTS_PER_PAIR} · ¡Sigue ${finder}!`,
      tone: 'success',
    }
  } else if (game.phase === 'mismatch') {
    status = { text: 'No coinciden. Pasa el turno…', tone: 'danger' }
  } else {
    status = { text: game.selected.length === 1 ? 'Elegí la segunda carta' : 'Elegí una carta', tone: 'neutral' }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-5">
        <p className="max-w-[24%] shrink-0 truncate text-2xl font-bold">
          <span className="text-muted">Juega </span>
          <span style={{ color: teamColor(activeIndex) }}>{activeTeam?.name}</span>
        </p>
        <div className="min-w-0 flex-1">
          <StatusBanner tone={status.tone}>{status.text}</StatusBanner>
        </div>
        <InfoPill>
          {game.matchedPairIds.length} de {game.pairs.length} parejas
        </InfoPill>
        <Button variant="secondary" className="shrink-0" onClick={restartBoard}>
          <Icon name="refresh" className="h-6 w-6" />
          Reiniciar tablero
        </Button>
      </div>

      <div className="relative mt-5 flex min-h-0 flex-1">
        <div className="grid flex-1 auto-rows-fr grid-cols-8 gap-[1.2vw] [@media(max-aspect-ratio:4/3)]:grid-cols-4">
          {game.cards.map((card, index) => {
            const faceUp = isFaceUp(game, card)
            const matched = game.matchedPairIds.includes(card.pairId)
            const mismatched = game.phase === 'mismatch' && game.selected.includes(card.id)
            return (
              <MemoryCardView
                key={`${game.boardId}-${card.id}`}
                pair={pairsById.get(card.pairId)!}
                position={index + 1}
                faceUp={faceUp}
                state={matched ? 'matched' : mismatched ? 'mismatched' : faceUp ? 'selected' : 'hidden'}
                justMatched={game.lastMatch?.pairId === card.pairId}
                disabled={game.phase !== 'playing' || faceUp}
                onFlip={() => send({ type: 'flip', cardId: card.id, teamId: session.activeTeamId })}
              />
            )
          })}
        </div>

        {(game.phase === 'complete' || game.phase === 'finished') && (
          <div className="absolute inset-0 grid place-items-center rounded-[var(--radius-panel)] bg-[rgb(236_238_243/0.82)]">
            <div className="rise-in flex flex-col items-center gap-5 rounded-[var(--radius-panel)] bg-white px-14 py-10 text-center shadow-[var(--shadow-elev-3)]">
              <span className="bg-success-soft text-success grid h-20 w-20 place-items-center rounded-full">
                <Icon name="check" className="h-11 w-11" strokeWidth={3} />
              </span>
              <p className="font-display text-ink text-6xl font-extrabold tracking-tight">¡Tablero completo!</p>
              <p className="text-ink-2 text-3xl font-medium">Encontraron las {game.pairs.length} parejas.</p>
              <Button size="xl" onClick={() => send({ type: 'showResults' })}>
                Ver resultados
                <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type CardState = 'hidden' | 'selected' | 'matched' | 'mismatched'

type MemoryCardViewProps = {
  pair: MemoryPair
  position: number
  faceUp: boolean
  state: CardState
  justMatched: boolean
  disabled: boolean
  onFlip: () => void
}

// Estado del frente: borde de color + insignia con ícono (no depende solo del color).
const FRONT_STATE: Record<Exclude<CardState, 'hidden'>, { ring: string; badge: string; icon: 'check' | 'x' | 'hand' }> = {
  selected: { ring: 'var(--color-accent)', badge: 'bg-accent', icon: 'hand' },
  matched: { ring: 'var(--color-success)', badge: 'bg-success', icon: 'check' },
  mismatched: { ring: 'var(--color-danger)', badge: 'bg-danger', icon: 'x' },
}

function MemoryCardView({ pair, position, faceUp, state, justMatched, disabled, onFlip }: MemoryCardViewProps) {
  const front = state === 'hidden' ? null : FRONT_STATE[state]
  return (
    <button
      type="button"
      onClick={onFlip}
      disabled={disabled}
      aria-label={faceUp ? pair.label : `Carta ${position}, boca abajo`}
      className={`group relative min-h-0 rounded-[var(--radius-control)] [perspective:1200px] ${disabled ? 'cursor-default' : 'cursor-pointer'} ${justMatched ? 'animate-[match-pop_0.6s_ease-out]' : ''}`}
    >
      {/* Elevación al pasar el cursor por una carta disponible. */}
      <div className="absolute inset-0 transition-transform duration-200 ease-out group-enabled:group-hover:-translate-y-1.5">
        <div
          className="absolute inset-0 transition-transform duration-500 ease-[var(--ease-soft)] transform-3d"
          style={{ transform: faceUp ? 'rotateY(180deg)' : 'none' }}
        >
          {/* Dorso: magenta institucional con trama sutil y el símbolo de Godoy Cruz sobre placa blanca. */}
          <div
            className="absolute inset-0 grid place-items-center overflow-hidden rounded-[var(--radius-control)] backface-hidden"
            style={{
              background:
                'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.06) 0 10px, transparent 10px 20px), linear-gradient(160deg, var(--color-accent) 0%, var(--color-accent-deep) 100%)',
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.35), inset 0 -4px 0 rgb(0 0 0 / 0.25), var(--shadow-elev-2)',
            }}
          >
            <span className="absolute inset-[7%] rounded-xl border-2 border-white/25" />
            <span className="grid aspect-square w-[52%] place-items-center overflow-hidden rounded-full bg-white p-[6%] shadow-[0_4px_10px_rgb(0_0_0/0.25)]">
              <img src={brand.symbol} alt="" className="max-h-full max-w-full object-contain mix-blend-multiply" draggable={false} />
            </span>
          </div>
          {/* Frente */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden rounded-[var(--radius-control)] bg-white backface-hidden"
            style={{
              transform: 'rotateY(180deg)',
              boxShadow: front ? `inset 0 0 0 5px ${front.ring}, var(--shadow-elev-2)` : 'var(--shadow-elev-2)',
            }}
          >
            {front && (
              <span className={`absolute top-2 right-2 z-10 grid h-9 w-9 place-items-center rounded-full text-white shadow ${front.badge}`}>
                <Icon name={front.icon} className="h-5 w-5" strokeWidth={3} />
              </span>
            )}
            <div className="relative min-h-0 flex-1">
              <img
                src={pair.image}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
                // Si la imagen falla se oculta: el nombre de la carta sigue visible y la pareja se puede jugar.
                onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
              />
            </div>
            <p className="bg-surface-2 text-ink border-line mx-[5px] mb-[5px] border-t px-2 py-2 text-center text-lg leading-tight font-bold">
              {pair.label}
            </p>
          </div>
        </div>
      </div>
    </button>
  )
}
