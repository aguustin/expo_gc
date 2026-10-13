// Guardado y recuperación del progreso de la ruleta (lo usa src/state/persistence.ts).
import { isIndex, isRecord, isTimestamp, isUniqueStringArray } from '../../state/validation.ts'
import { createRouletteState, type Outcome, type RoulettePhase, type RouletteQuestion, type RouletteState } from './rouletteLogic.ts'

export type RouletteSnapshot = {
  phase: RoulettePhase
  usedIds: string[]
  currentId: string | null
  deadline: number | null
  selectedOption: number | null
  outcome: Outcome | null
  answeredBy: string | null
  resolvedCount: number
}

export function serializeRoulette(state: RouletteState): RouletteSnapshot {
  const snapshot: RouletteSnapshot = {
    phase: state.phase,
    usedIds: state.usedIds,
    currentId: state.current?.id ?? null,
    deadline: state.deadline,
    selectedOption: state.selectedOption,
    outcome: state.outcome,
    answeredBy: state.answeredBy,
    resolvedCount: state.resolvedCount,
  }
  // El giro es transitorio: se guarda como si no hubiera empezado (la pregunta sorteada sigue disponible).
  if (state.phase === 'spinning') {
    return { ...snapshot, phase: 'idle', currentId: null, usedIds: state.usedIds.filter((id) => id !== state.current?.id) }
  }
  return snapshot
}

// Devuelve null si el progreso guardado no es coherente con los datos y las reglas actuales.
export function restoreRoulette(raw: unknown, pool: RouletteQuestion[], teamIds: string[]): RouletteState | null {
  if (!isRecord(raw)) return null
  const { phase, usedIds, currentId, deadline, selectedOption, outcome, answeredBy, resolvedCount } = raw
  const base = createRouletteState(pool)
  if (!isUniqueStringArray(usedIds) || !usedIds.every((id) => pool.some((q) => q.id === id))) return null
  if (!Number.isInteger(resolvedCount) || (resolvedCount as number) < 0 || (resolvedCount as number) > base.total) return null
  const resolved = resolvedCount as number
  const current = currentId === null ? null : pool.find((q) => q.id === currentId)
  if (current === undefined) return null
  const restored: RouletteState = { ...base, usedIds, resolvedCount: resolved, current }

  switch (phase) {
    case 'idle':
      if (current || usedIds.length !== resolved || resolved >= base.total) return null
      return restored
    case 'answering':
      if (!current || usedIds.at(-1) !== current.id || usedIds.length !== resolved + 1 || !isTimestamp(deadline)) return null
      return { ...restored, phase, deadline }
    case 'revealed': {
      if (!current || usedIds.at(-1) !== current.id || usedIds.length !== resolved || resolved < 1) return null
      if (!isTimestamp(deadline) || typeof answeredBy !== 'string' || !teamIds.includes(answeredBy)) return null
      if (outcome === 'timeout') {
        if (selectedOption !== null) return null
      } else if (outcome === 'correct' || outcome === 'wrong') {
        if (!isIndex(selectedOption, current.options.length)) return null
        if ((selectedOption === current.correctOption) !== (outcome === 'correct')) return null
      } else return null
      return { ...restored, phase, deadline, selectedOption: selectedOption as number | null, outcome, answeredBy }
    }
    default:
      // 'spinning' nunca se guarda y 'finished' ya cerró el juego: no se restauran.
      return null
  }
}
