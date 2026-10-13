// Único punto de acceso a sessionStorage. Guarda la sesión y el progreso del juego en curso
// en una sola entrada versionada, para recuperar la partida tras una recarga accidental.
// sessionStorage sobrevive a recargas de la misma pestaña, pero no a cerrarla.
import { PLACES } from '../games/location/locations.ts'
import { restoreLocation } from '../games/location/locationSnapshot.ts'
import { MEMORY_PAIRS } from '../games/memory/pairs.ts'
import { restoreMemory } from '../games/memory/memorySnapshot.ts'
import { ROULETTE_QUESTIONS } from '../games/roulette/questions.ts'
import { restoreRoulette } from '../games/roulette/rouletteSnapshot.ts'
import { currentGameId, parseSavedSession, type GameId, type SessionState } from './session.ts'
import { isRecord } from './validation.ts'

const STORAGE_KEY = 'godoy-cruz-expo/session'
// Subir la versión si cambia el formato guardado: las partidas con otra versión no se recuperan.
// v2: «¿Dónde queda?» guarda la modalidad elegida y el punto marcado en el mapa.
const STORAGE_VERSION = 2

type StoredGame = { key: string; snapshot: unknown }
type StoredData = { version: number; session: SessionState; game: StoredGame | null }

// Cada juego valida su progreso contra los datos actuales; si no coincide, la partida no se recupera.
const GAME_RESTORERS: Record<GameId, (snapshot: unknown, teamIds: string[]) => unknown> = {
  roulette: (snapshot, teamIds) => restoreRoulette(snapshot, ROULETTE_QUESTIONS, teamIds),
  memory: (snapshot, teamIds) => restoreMemory(snapshot, MEMORY_PAIRS, teamIds),
  location: (snapshot, teamIds) => restoreLocation(snapshot, PLACES, teamIds),
}

// Copia en memoria de lo guardado: la sesión y el progreso del juego se escriben juntos.
let savedSession: SessionState | null = null
let savedGame: StoredGame | null = null

// Clave del progreso de un juego: atada a la partida y a la posición dentro del desafío.
export function gameProgressKey(session: SessionState): string | null {
  const gameId = currentGameId(session)
  if (!session.sessionId || !gameId || session.phase !== 'playing') return null
  return `${session.sessionId}:${session.gameIndex}:${gameId}`
}

function write() {
  try {
    if (!savedSession) {
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    const key = gameProgressKey(savedSession)
    const data: StoredData = {
      version: STORAGE_VERSION,
      session: savedSession,
      game: key && savedGame?.key === key ? savedGame : null,
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota llena): la app sigue funcionando sin recuperación.
  }
}

export type Recovery = { status: 'none' } | { status: 'restored'; session: SessionState } | { status: 'failed' }

// Se llama una vez al iniciar la app. No borra nada: si falla, el aviso decide qué hacer.
export function recoverSession(): Recovery {
  let raw: string | null
  try {
    raw = sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'none' }
  }
  if (raw === null) return { status: 'none' }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { status: 'failed' }
  }
  if (!isRecord(data) || data.version !== STORAGE_VERSION) return { status: 'failed' }
  const session = parseSavedSession(data.session)
  if (!session) return { status: 'failed' }

  // En pleno juego, el progreso del juego es obligatorio: sin él se podrían volver a ganar puntos ya sumados.
  const key = gameProgressKey(session)
  let game: StoredGame | null = null
  if (key) {
    const stored = data.game
    if (!isRecord(stored) || stored.key !== key) return { status: 'failed' }
    const teamIds = session.teams.map((team) => team.id)
    if (GAME_RESTORERS[currentGameId(session)!](stored.snapshot, teamIds) === null) return { status: 'failed' }
    game = { key, snapshot: stored.snapshot }
  }

  savedSession = session
  savedGame = game
  return { status: 'restored', session }
}

// Solo se guardan partidas en curso; al volver al menú o terminar, se borra lo guardado.
export function persistSession(session: SessionState) {
  savedSession = session.phase === 'playing' || session.phase === 'intermission' ? session : null
  if (!savedSession) savedGame = null
  write()
}

export function persistGameProgress(key: string, snapshot: unknown) {
  savedGame = { key, snapshot }
  write()
}

// Progreso guardado para este juego, ya validado; null si no hay o no corresponde a esta partida.
export function loadGameProgress<T>(key: string | null, gameId: GameId, teamIds: string[]): T | null {
  if (!key || savedGame?.key !== key) return null
  return GAME_RESTORERS[gameId](savedGame.snapshot, teamIds) as T | null
}

export function clearSavedSession() {
  savedSession = null
  savedGame = null
  write()
}
