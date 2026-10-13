// Lógica pura de Memoria (sin React) para poder verificarla de forma aislada.
// Igual que la ruleta: cada evento devuelve el nuevo estado local y las acciones de sesión
// a despachar. Puntaje y turno viven solo en la sesión.
import type { SessionAction } from '../../state/session.ts'

export const PAIRS_PER_GAME = 8
export const POINTS_PER_PAIR = 100
export const MISMATCH_DELAY_MS = 1500

export type MemoryPair = {
  id: string
  label: string
  image: string
}

// Dos cartas por pareja: comparten pairId pero cada una tiene su propio id.
export type MemoryCard = {
  id: string
  pairId: string
}

// playing → (mismatch → playing)* → complete → finished
export type MemoryPhase = 'playing' | 'mismatch' | 'complete' | 'finished'

export type MemoryState = {
  // Cambia en cada tablero nuevo: una acción pendiente de un tablero anterior no lo afecta.
  boardId: number
  pairs: MemoryPair[]
  cards: MemoryCard[]
  phase: MemoryPhase
  selected: string[]
  matchedPairIds: string[]
  // Última pareja encontrada y quién la encontró (solo para el feedback visual).
  lastMatch: { pairId: string; teamId: string } | null
}

export type MemoryEvent =
  | { type: 'flip'; cardId: string; teamId: string | null }
  | { type: 'hide'; boardId: number }
  | { type: 'showResults' }

export type MemoryStep = {
  state: MemoryState
  effects: SessionAction[]
}

export function parsePairs(raw: unknown): { pairs: MemoryPair[]; rejected: number } {
  const items = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const pairs: MemoryPair[] = []
  for (const item of items) {
    const { id, label, image } = (item ?? {}) as Record<string, unknown>
    const valid =
      typeof id === 'string' &&
      id.trim() !== '' &&
      !seen.has(id) &&
      typeof label === 'string' &&
      label.trim() !== '' &&
      typeof image === 'string' &&
      image.trim() !== ''
    if (!valid) continue
    seen.add(id)
    pairs.push({ id, label, image })
  }
  return { pairs, rejected: items.length - pairs.length }
}

// Fisher-Yates con generador inyectable para poder verificarlo.
export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createMemoryState(allPairs: MemoryPair[], random: () => number, boardId = 1): MemoryState {
  const pairs = shuffle(allPairs, random).slice(0, PAIRS_PER_GAME)
  const cards = shuffle(
    pairs.flatMap((pair) => [
      { id: `${pair.id}#a`, pairId: pair.id },
      { id: `${pair.id}#b`, pairId: pair.id },
    ]),
    random,
  )
  return { boardId, pairs, cards, phase: 'playing', selected: [], matchedPairIds: [], lastMatch: null }
}

export function isFaceUp(state: MemoryState, card: MemoryCard): boolean {
  return state.selected.includes(card.id) || state.matchedPairIds.includes(card.pairId)
}

const unchanged = (state: MemoryState): MemoryStep => ({ state, effects: [] })

export function memoryStep(state: MemoryState, event: MemoryEvent): MemoryStep {
  switch (event.type) {
    case 'flip': {
      if (state.phase !== 'playing' || event.teamId === null || state.selected.length >= 2) return unchanged(state)
      const card = state.cards.find((c) => c.id === event.cardId)
      if (!card || state.selected.includes(card.id) || state.matchedPairIds.includes(card.pairId)) {
        return unchanged(state)
      }
      if (state.selected.length === 0) {
        return { state: { ...state, selected: [card.id], lastMatch: null }, effects: [] }
      }

      const first = state.cards.find((c) => c.id === state.selected[0])!
      // Se compara por identificador de pareja, nunca por texto o imagen.
      if (first.pairId !== card.pairId) {
        return { state: { ...state, phase: 'mismatch', selected: [first.id, card.id] }, effects: [] }
      }
      const matchedPairIds = [...state.matchedPairIds, card.pairId]
      return {
        state: {
          ...state,
          phase: matchedPairIds.length === state.pairs.length ? 'complete' : 'playing',
          selected: [],
          matchedPairIds,
          lastMatch: { pairId: card.pairId, teamId: event.teamId },
        },
        // El equipo conserva el turno: no hay nextTurn.
        effects: [{ type: 'addPoints', teamId: event.teamId, points: POINTS_PER_PAIR }],
      }
    }

    case 'hide':
      if (state.phase !== 'mismatch' || event.boardId !== state.boardId) return unchanged(state)
      return { state: { ...state, phase: 'playing', selected: [] }, effects: [{ type: 'nextTurn' }] }

    case 'showResults':
      if (state.phase !== 'complete') return unchanged(state)
      return { state: { ...state, phase: 'finished' }, effects: [{ type: 'finishGame' }] }
  }
}
