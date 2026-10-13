// Guardado y recuperación del progreso de Memoria (lo usa src/state/persistence.ts).
import { isRecord, isUniqueStringArray } from '../../state/validation.ts'
import { PAIRS_PER_GAME, type MemoryCard, type MemoryPair, type MemoryPhase, type MemoryState } from './memoryLogic.ts'

export type MemorySnapshot = {
  boardId: number
  // Parejas del tablero, en el mismo orden que el estado original.
  pairIds: string[]
  // Orden del tablero; cada id es `${pairId}#a` o `${pairId}#b`.
  cardIds: string[]
  phase: MemoryPhase
  selected: string[]
  matchedPairIds: string[]
  lastMatch: { pairId: string; teamId: string } | null
}

export function serializeMemory(state: MemoryState): MemorySnapshot {
  return {
    boardId: state.boardId,
    pairIds: state.pairs.map((pair) => pair.id),
    cardIds: state.cards.map((card) => card.id),
    phase: state.phase,
    selected: state.selected,
    matchedPairIds: state.matchedPairIds,
    lastMatch: state.lastMatch,
  }
}

// Devuelve null si el progreso guardado no es coherente con los datos y las reglas actuales.
// Una jugada fallida pendiente ('mismatch') se restaura tal cual: el componente vuelve a
// programar el ocultado y el turno avanza una sola vez, porque todavía no había avanzado.
export function restoreMemory(raw: unknown, allPairs: MemoryPair[], teamIds: string[]): MemoryState | null {
  if (!isRecord(raw)) return null
  const { boardId, pairIds, cardIds, phase, selected, matchedPairIds, lastMatch } = raw
  if (!Number.isInteger(boardId) || (boardId as number) < 1) return null
  if (!isUniqueStringArray(cardIds)) return null

  const cards: MemoryCard[] = []
  for (const id of cardIds) {
    if (!id.endsWith('#a') && !id.endsWith('#b')) return null
    cards.push({ id, pairId: id.slice(0, -2) })
  }
  if (!isUniqueStringArray(pairIds)) return null
  const pairs = pairIds.map((id) => allPairs.find((pair) => pair.id === id))
  if (pairs.length !== PAIRS_PER_GAME || pairs.some((pair) => !pair)) return null
  // Cada pareja del tablero aparece exactamente dos veces (#a y #b) y no hay cartas de otras parejas.
  if (cards.length !== pairIds.length * 2 || !cards.every((card) => pairIds.includes(card.pairId))) return null

  if (!isUniqueStringArray(matchedPairIds) || !matchedPairIds.every((id) => pairIds.includes(id))) return null
  if (!isUniqueStringArray(selected)) return null
  const selectedCards = selected.map((id) => cards.find((card) => card.id === id))
  if (selectedCards.some((card) => !card || matchedPairIds.includes(card.pairId))) return null

  const allMatched = matchedPairIds.length === pairIds.length
  if (phase === 'playing') {
    if (selected.length > 1 || allMatched) return null
  } else if (phase === 'mismatch') {
    if (selected.length !== 2 || selectedCards[0]?.pairId === selectedCards[1]?.pairId) return null
  } else if (phase === 'complete') {
    if (selected.length !== 0 || !allMatched) return null
  } else return null // 'finished' ya cerró el juego.

  let parsedLastMatch: MemoryState['lastMatch'] = null
  if (lastMatch !== null) {
    if (!isRecord(lastMatch)) return null
    const { pairId, teamId } = lastMatch
    if (typeof pairId !== 'string' || !matchedPairIds.includes(pairId)) return null
    if (typeof teamId !== 'string' || !teamIds.includes(teamId)) return null
    parsedLastMatch = { pairId, teamId }
  }

  return {
    boardId: boardId as number,
    pairs: pairs as MemoryPair[],
    cards,
    phase,
    selected,
    matchedPairIds,
    lastMatch: parsedLastMatch,
  }
}
