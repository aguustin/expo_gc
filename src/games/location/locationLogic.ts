// Lógica pura de «¿Dónde queda?» (sin React) para poder verificarla de forma aislada.
// Mismo patrón que la ruleta: cada evento devuelve el nuevo estado local y las acciones de
// sesión a despachar. Puntaje y turno viven solo en la sesión.
// Dos modalidades comparten el mismo flujo (mostrar → responder o vencer → continuar);
// solo cambia cómo se evalúa la respuesta: opción elegida o punto marcado en el mapa.
import type { SessionAction } from '../../state/session.ts'

export const MAX_LOCATIONS_PER_GAME = 8
export const POINTS_PER_CORRECT_ANSWER = 150
export const ANSWER_TIME_MS = 30_000
export const OPTIONS_PER_LOCATION = 4

// Distancia máxima (en metros) entre el punto marcado y el lugar para considerar acierto en el mapa.
// Valor inicial razonado: con la zona completa en pantalla, 1 px ≈ 9–10 m en un TV 1080p y la
// puntería con mouse a distancia ronda ±150–190 m; 250 m (≈ 2,5 cuadras) absorbe ese error y aun así
// distingue los pares Colombo–Gambarte (407 m) y Arizu–Casino (486 m). Plaza, Cine Teatro y Concejo
// están a 75–184 m entre sí: a esta escala ninguna tolerancia los separa. Ajustar tras probar en el TV.
export const MAP_TOLERANCE_METERS = 250

export type GeoPoint = { lat: number; lon: number }

// Lugar del catálogo común. image es null mientras falte la fotografía real.
export type Place = GeoPoint & {
  id: string
  name: string
  address: string
  image: string | null
}

export type LocationVariant = 'photo' | 'map'

export type Outcome = 'correct' | 'wrong' | 'timeout'

// choosing → ready → answering → revealed → (ready | finished)
export type LocationPhase = 'choosing' | 'ready' | 'answering' | 'revealed' | 'finished'

export type LocationState = {
  // Cambia al reiniciar: un vencimiento pendiente de una partida anterior no afecta a la nueva.
  gameId: number
  places: Place[]
  // Modalidad elegida al empezar; se mantiene durante toda la partida.
  variant: LocationVariant | null
  total: number
  phase: LocationPhase
  usedIds: string[]
  current: Place | null
  deadline: number | null
  selectedOption: number | null
  selectedPoint: GeoPoint | null
  outcome: Outcome | null
  // Equipo que tenía el turno al resolverse (solo para mostrar el resultado).
  answeredBy: string | null
  resolvedCount: number
}

export type LocationEvent =
  | { type: 'choose'; variant: LocationVariant }
  | { type: 'show'; random: number; now: number }
  | { type: 'answer'; option: number; teamId: string | null; now: number }
  | { type: 'answerPoint'; point: GeoPoint; teamId: string | null; now: number }
  | { type: 'timeout'; gameId: number; teamId: string | null; now: number }
  | { type: 'continue' }

export type LocationStep = {
  state: LocationState
  effects: SessionAction[]
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const isLatitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 90
const isLongitude = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 180

// Descarta registros mal formados para que el juego nunca falle por los datos.
export function parsePlaces(raw: unknown): { places: Place[]; rejected: number } {
  const items = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const places: Place[] = []
  for (const item of items) {
    const { id, name, address, lat, lon, image } = (item ?? {}) as Record<string, unknown>
    const valid =
      nonEmpty(id) &&
      !seen.has(id) &&
      nonEmpty(name) &&
      nonEmpty(address) &&
      isLatitude(lat) &&
      isLongitude(lon) &&
      (image === null || image === undefined || nonEmpty(image))
    if (!valid) continue
    seen.add(id)
    places.push({ id, name, address, lat, lon, image: (image as string | null | undefined) ?? null })
  }
  return { places, rejected: items.length - places.length }
}

// Por qué una modalidad no se puede jugar con el catálogo actual (null si se puede).
export function variantUnavailableReason(places: Place[], variant: LocationVariant): string | null {
  if (places.length === 0) return 'No hay lugares válidos en el catálogo.'
  if (variant === 'photo') {
    const missing = places.filter((place) => !place.image).length
    if (missing > 0) return `Faltan las fotografías de ${missing} de ${places.length} lugares.`
    if (places.length < OPTIONS_PER_LOCATION) return `Se necesitan al menos ${OPTIONS_PER_LOCATION} lugares.`
  }
  return null
}

// Opciones de la modalidad con fotos: el lugar correcto y tres lugares más del catálogo.
// Son deterministas (dependen solo del catálogo), así una partida recuperada muestra las mismas.
export function photoOptions(place: Place, places: Place[]): { options: string[]; correctOption: number } {
  const index = places.findIndex((p) => p.id === place.id)
  const others = places.filter((p) => p.id !== place.id)
  const shift = index % others.length
  const distractors = [...others.slice(shift), ...others.slice(0, shift)].slice(0, OPTIONS_PER_LOCATION - 1)
  const correctOption = index % OPTIONS_PER_LOCATION
  const options = distractors.map((p) => p.name)
  options.splice(correctOption, 0, place.name)
  return { options, correctOption }
}

// Distancia sobre la superficie terrestre (haversine, radio medio WGS84). Error < 0,5 % a esta escala.
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h))
}

export function isWithinTolerance(point: GeoPoint, place: Place): boolean {
  return distanceMeters(point, place) <= MAP_TOLERANCE_METERS
}

export function createLocationState(places: Place[], gameId = 1, variant: LocationVariant | null = null): LocationState {
  const usable = variant !== null && variantUnavailableReason(places, variant) === null
  return {
    gameId,
    places,
    variant: usable ? variant : null,
    total: Math.min(MAX_LOCATIONS_PER_GAME, places.length),
    phase: usable ? 'ready' : 'choosing',
    usedIds: [],
    current: null,
    deadline: null,
    selectedOption: null,
    selectedPoint: null,
    outcome: null,
    answeredBy: null,
    resolvedCount: 0,
  }
}

export function availableLocations(state: LocationState): Place[] {
  return state.places.filter((place) => !state.usedIds.includes(place.id))
}

type Answer = { option: number | null; point: GeoPoint | null }

function resolve(state: LocationState, outcome: Outcome, teamId: string, answer: Answer): LocationStep {
  return {
    state: {
      ...state,
      phase: 'revealed',
      selectedOption: answer.option,
      selectedPoint: answer.point,
      outcome,
      answeredBy: teamId,
      resolvedCount: state.resolvedCount + 1,
    },
    effects: outcome === 'correct' ? [{ type: 'addPoints', teamId, points: POINTS_PER_CORRECT_ANSWER }] : [],
  }
}

const NO_ANSWER: Answer = { option: null, point: null }
const unchanged = (state: LocationState): LocationStep => ({ state, effects: [] })

export function locationStep(state: LocationState, event: LocationEvent): LocationStep {
  switch (event.type) {
    case 'choose':
      if (state.phase !== 'choosing' || variantUnavailableReason(state.places, event.variant) !== null) {
        return unchanged(state)
      }
      return { state: { ...state, variant: event.variant, phase: 'ready' }, effects: [] }

    case 'show': {
      if (state.phase !== 'ready' || state.resolvedCount >= state.total) return unchanged(state)
      const available = availableLocations(state)
      if (available.length === 0) return unchanged(state)
      const index = Math.min(available.length - 1, Math.floor(Math.max(0, event.random) * available.length))
      const current = available[index]
      // Se marca como usada al mostrarse: no puede repetirse aunque no llegue a resolverse.
      return {
        state: {
          ...state,
          phase: 'answering',
          current,
          usedIds: [...state.usedIds, current.id],
          deadline: event.now + ANSWER_TIME_MS,
        },
        effects: [],
      }
    }

    case 'answer': {
      if (state.variant !== 'photo' || state.phase !== 'answering' || !state.current || state.deadline === null) {
        return unchanged(state)
      }
      if (event.teamId === null || !Number.isInteger(event.option) || event.option < 0 || event.option >= OPTIONS_PER_LOCATION) {
        return unchanged(state)
      }
      // Una respuesta que llega con el tiempo vencido cuenta como tiempo agotado.
      if (event.now >= state.deadline) return resolve(state, 'timeout', event.teamId, NO_ANSWER)
      // Se valida por índice, nunca comparando textos.
      const { correctOption } = photoOptions(state.current, state.places)
      const outcome = event.option === correctOption ? 'correct' : 'wrong'
      return resolve(state, outcome, event.teamId, { option: event.option, point: null })
    }

    case 'answerPoint': {
      if (state.variant !== 'map' || state.phase !== 'answering' || !state.current || state.deadline === null) {
        return unchanged(state)
      }
      const { lat, lon } = event.point
      if (event.teamId === null || !isLatitude(lat) || !isLongitude(lon)) return unchanged(state)
      if (event.now >= state.deadline) return resolve(state, 'timeout', event.teamId, NO_ANSWER)
      const outcome = isWithinTolerance(event.point, state.current) ? 'correct' : 'wrong'
      return resolve(state, outcome, event.teamId, { option: null, point: { lat, lon } })
    }

    case 'timeout':
      if (
        state.phase !== 'answering' ||
        event.gameId !== state.gameId ||
        state.deadline === null ||
        event.now < state.deadline ||
        event.teamId === null
      ) {
        return unchanged(state)
      }
      return resolve(state, 'timeout', event.teamId, NO_ANSWER)

    case 'continue': {
      if (state.phase !== 'revealed') return unchanged(state)
      const cleared = {
        ...state,
        current: null,
        deadline: null,
        selectedOption: null,
        selectedPoint: null,
        outcome: null,
        answeredBy: null,
      }
      const isOver = state.resolvedCount >= state.total || availableLocations(state).length === 0
      if (isOver) return { state: { ...cleared, phase: 'finished' }, effects: [{ type: 'finishGame' }] }
      return { state: { ...cleared, phase: 'ready' }, effects: [{ type: 'nextTurn' }] }
    }
  }
}
