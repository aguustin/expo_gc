// Guardado y recuperación del progreso de «¿Dónde queda?» (lo usa src/state/persistence.ts).
import { isIndex, isRecord, isTimestamp, isUniqueStringArray } from '../../state/validation.ts'
import {
  createLocationState,
  isWithinTolerance,
  OPTIONS_PER_LOCATION,
  photoOptions,
  variantUnavailableReason,
  type GeoPoint,
  type LocationPhase,
  type LocationState,
  type LocationVariant,
  type Outcome,
  type Place,
} from './locationLogic.ts'

export type LocationSnapshot = {
  gameId: number
  variant: LocationVariant | null
  phase: LocationPhase
  usedIds: string[]
  currentId: string | null
  deadline: number | null
  selectedOption: number | null
  selectedPoint: GeoPoint | null
  outcome: Outcome | null
  answeredBy: string | null
  resolvedCount: number
}

export function serializeLocation(state: LocationState): LocationSnapshot {
  return {
    gameId: state.gameId,
    variant: state.variant,
    phase: state.phase,
    usedIds: state.usedIds,
    currentId: state.current?.id ?? null,
    deadline: state.deadline,
    selectedOption: state.selectedOption,
    selectedPoint: state.selectedPoint,
    outcome: state.outcome,
    answeredBy: state.answeredBy,
    resolvedCount: state.resolvedCount,
  }
}

function parsePoint(value: unknown): GeoPoint | null {
  if (!isRecord(value)) return null
  const { lat, lon } = value
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

// Devuelve null si el progreso guardado no es coherente con los datos y las reglas actuales.
export function restoreLocation(raw: unknown, places: Place[], teamIds: string[]): LocationState | null {
  if (!isRecord(raw)) return null
  const { gameId, variant, phase, usedIds, currentId, deadline, selectedOption, selectedPoint, outcome, answeredBy, resolvedCount } = raw
  if (!Number.isInteger(gameId) || (gameId as number) < 1) return null
  if (phase === 'choosing') {
    if (variant !== null || !isUniqueStringArray(usedIds) || usedIds.length > 0 || resolvedCount !== 0 || currentId !== null) {
      return null
    }
    return createLocationState(places, gameId as number)
  }

  // La modalidad tiene que seguir siendo jugable con el catálogo actual (p. ej. fotos presentes).
  if (variant !== 'photo' && variant !== 'map') return null
  if (variantUnavailableReason(places, variant) !== null) return null
  const base = createLocationState(places, gameId as number, variant)
  if (!isUniqueStringArray(usedIds) || !usedIds.every((id) => places.some((p) => p.id === id))) return null
  if (!Number.isInteger(resolvedCount) || (resolvedCount as number) < 0 || (resolvedCount as number) > base.total) return null
  const resolved = resolvedCount as number
  const current = currentId === null ? null : places.find((p) => p.id === currentId)
  if (current === undefined) return null
  const restored: LocationState = { ...base, usedIds, resolvedCount: resolved, current }

  switch (phase) {
    case 'ready':
      if (current || usedIds.length !== resolved || resolved >= base.total) return null
      return restored
    case 'answering':
      if (!current || usedIds.at(-1) !== current.id || usedIds.length !== resolved + 1 || !isTimestamp(deadline)) return null
      return { ...restored, phase, deadline }
    case 'revealed': {
      if (!current || usedIds.at(-1) !== current.id || usedIds.length !== resolved || resolved < 1) return null
      if (!isTimestamp(deadline) || typeof answeredBy !== 'string' || !teamIds.includes(answeredBy)) return null
      const revealed: LocationState = { ...restored, phase, deadline, answeredBy }
      if (outcome === 'timeout') {
        if (selectedOption !== null || selectedPoint !== null) return null
        return { ...revealed, outcome }
      }
      if (outcome !== 'correct' && outcome !== 'wrong') return null
      if (variant === 'photo') {
        if (selectedPoint !== null || !isIndex(selectedOption, OPTIONS_PER_LOCATION)) return null
        if ((selectedOption === photoOptions(current, places).correctOption) !== (outcome === 'correct')) return null
        return { ...revealed, outcome, selectedOption }
      }
      const point = parsePoint(selectedPoint)
      if (selectedOption !== null || !point) return null
      if (isWithinTolerance(point, current) !== (outcome === 'correct')) return null
      return { ...revealed, outcome, selectedPoint: point }
    }
    default:
      // 'finished' ya cerró el juego: no se restaura.
      return null
  }
}
