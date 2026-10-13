import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button.tsx'
import { GameDataError } from '../../components/GameDataError.tsx'
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

  let status: { text: string; className: string }
  if (game.lastMatch) {
    const finder = session.teams[teamIndex(game.lastMatch.teamId)]?.name ?? ''
    status = {
      text: game.phase === 'complete' ? `¡Pareja! +${POINTS_PER_PAIR} para ${finder}` : `¡Pareja! +${POINTS_PER_PAIR} · ¡Sigue ${finder}!`,
      className: 'bg-accent-3 text-night',
    }
  } else if (game.phase === 'mismatch') {
    status = { text: 'No coinciden. Pasa el turno…', className: 'bg-accent text-white' }
  } else {
    status = {
      text: game.selected.length === 1 ? 'Elegí la segunda carta' : 'Elegí una carta',
      className: 'bg-night/60 text-ink',
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-5">
        <p className="shrink-0 text-2xl font-bold">
          <span className="text-muted">Juega </span>
          <span style={{ color: teamColor(activeIndex) }}>{activeTeam?.name}</span>
        </p>
        <p
          className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-2xl px-6 text-2xl font-black transition-colors ${status.className}`}
          role="status"
        >
          <span className="truncate">{status.text}</span>
        </p>
        <p className="bg-night/60 shrink-0 rounded-full px-5 py-1 text-2xl font-extrabold tabular-nums">
          {game.matchedPairIds.length} de {game.pairs.length} parejas
        </p>
        <Button variant="secondary" className="shrink-0 px-5 py-3 text-lg" onClick={restartBoard}>
          ↻ Reiniciar tablero
        </Button>
      </div>

      <div className="relative mt-4 flex min-h-0 flex-1">
        <div className="grid flex-1 auto-rows-fr grid-cols-8 gap-[1.2vw] [@media(max-aspect-ratio:4/3)]:grid-cols-4">
          {game.cards.map((card, index) => {
            const faceUp = isFaceUp(game, card)
            const matched = game.matchedPairIds.includes(card.pairId)
            return (
              <MemoryCardView
                key={`${game.boardId}-${card.id}`}
                pair={pairsById.get(card.pairId)!}
                position={index + 1}
                faceUp={faceUp}
                matched={matched}
                justMatched={game.lastMatch?.pairId === card.pairId}
                mismatched={game.phase === 'mismatch' && game.selected.includes(card.id)}
                disabled={game.phase !== 'playing' || faceUp}
                onFlip={() => send({ type: 'flip', cardId: card.id, teamId: session.activeTeamId })}
              />
            )
          })}
        </div>

        {(game.phase === 'complete' || game.phase === 'finished') && (
          <div className="bg-night/75 absolute inset-0 flex flex-col items-center justify-center gap-8 rounded-[2rem] text-center backdrop-blur-sm">
            <p className="font-display text-6xl uppercase">¡Tablero completo!</p>
            <p className="text-muted text-3xl font-semibold">Encontraron las {game.pairs.length} parejas.</p>
            <Button className="px-12 py-5 text-3xl" onClick={() => send({ type: 'showResults' })}>
              Ver resultados
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

type MemoryCardViewProps = {
  pair: MemoryPair
  position: number
  faceUp: boolean
  matched: boolean
  justMatched: boolean
  mismatched: boolean
  disabled: boolean
  onFlip: () => void
}

function MemoryCardView({ pair, position, faceUp, matched, justMatched, mismatched, disabled, onFlip }: MemoryCardViewProps) {
  const ring = matched ? 'ring-accent-3' : mismatched ? 'ring-accent' : 'ring-transparent'
  return (
    <button
      type="button"
      onClick={onFlip}
      disabled={disabled}
      aria-label={faceUp ? pair.label : `Carta ${position}, boca abajo`}
      className={`group relative min-h-0 rounded-2xl perspective-[1200px] ${disabled ? 'cursor-default' : 'cursor-pointer'} ${justMatched ? 'animate-[match-pop_0.6s_ease-out]' : ''}`}
    >
      <div
        className="absolute inset-0 transition-transform duration-500 transform-3d"
        style={{ transform: faceUp ? 'rotateY(180deg)' : 'none' }}
      >
        {/* Dorso */}
        <div className="bg-surface-strong absolute inset-0 grid place-items-center overflow-hidden rounded-2xl ring-4 ring-white/15 backface-hidden group-enabled:group-hover:ring-white/50">
          <div className="absolute inset-[8%] rounded-xl border-4 border-dashed border-white/10" />
          <span className="font-display text-accent-2 text-6xl">?</span>
        </div>
        {/* Frente */}
        <div
          className={`bg-ink absolute inset-0 flex flex-col overflow-hidden rounded-2xl ring-6 backface-hidden ${ring}`}
          style={{ transform: 'rotateY(180deg)' }}
        >
          <div className="relative min-h-0 flex-1">
            <img
              src={pair.image}
              alt=""
              className="absolute inset-0 h-full w-full object-contain p-[10%]"
              draggable={false}
              // Si la imagen falla se oculta: el nombre de la carta sigue visible y la pareja se puede jugar.
              onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
            />
          </div>
          <p className="text-night px-2 pb-2 text-center text-lg leading-tight font-extrabold">{pair.label}</p>
        </div>
      </div>
    </button>
  )
}
