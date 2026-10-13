// Estado de la sesión: lógica pura (sin React) para poder verificarla de forma aislada.
// Es la única fuente de verdad de equipos, puntajes y turno; los juegos deben usar
// estas acciones en lugar de llevar marcadores propios.

export type GameId = 'roulette' | 'memory' | 'location'

export const MIN_TEAMS = 2
export const MAX_TEAMS = 4
export const MAX_TEAM_NAME_LENGTH = 24

export type Team = {
  id: string
  name: string
  score: number
}

export type GameMode = { kind: 'single'; game: GameId } | { kind: 'challenge' }

// Orden fijo de los juegos en el desafío completo.
export const CHALLENGE_ORDER: GameId[] = ['roulette', 'memory', 'location']

// menu → setup → playing → results
// En el desafío: playing → intermission → playing → … → results
export type SessionPhase = 'menu' | 'setup' | 'playing' | 'intermission' | 'results'

export type SessionState = {
  // Identifica la partida: evita mezclar progreso guardado de una partida anterior con una nueva.
  sessionId: string | null
  phase: SessionPhase
  mode: GameMode | null
  teams: Team[]
  activeTeamId: string | null
  // Posición del juego actual dentro del desafío (siempre 0 en un juego individual).
  gameIndex: number
}

export type SessionAction =
  | { type: 'selectMode'; mode: GameMode }
  | { type: 'startSession'; names: string[]; sessionId: string }
  | { type: 'addPoints'; teamId: string; points: number }
  | { type: 'nextTurn' }
  // Lo despacha un juego al terminar. La sesión decide si sigue otro juego o se cierra.
  | { type: 'finishGame' }
  // Sale de la pausa entre juegos del desafío hacia el siguiente juego.
  | { type: 'nextGame' }
  | { type: 'backToMenu' }

export const initialSessionState: SessionState = {
  sessionId: null,
  phase: 'menu',
  mode: null,
  teams: [],
  activeTeamId: null,
  gameIndex: 0,
}

export function currentGameId(state: SessionState): GameId | null {
  if (state.mode?.kind === 'single') return state.mode.game
  if (state.mode?.kind === 'challenge') return CHALLENGE_ORDER[state.gameIndex] ?? null
  return null
}

export function isLastGame(state: SessionState): boolean {
  return state.mode?.kind !== 'challenge' || state.gameIndex >= CHALLENGE_ORDER.length - 1
}

export type TeamNamesErrors = {
  count: string | null
  names: (string | null)[]
}

export function validateTeamNames(names: string[]): TeamNamesErrors {
  const count =
    names.length < MIN_TEAMS || names.length > MAX_TEAMS
      ? `Tiene que haber entre ${MIN_TEAMS} y ${MAX_TEAMS} equipos.`
      : null

  const normalized = names.map((name) => name.trim().toLocaleLowerCase('es'))
  const errors = names.map((name, index) => {
    const trimmed = name.trim()
    if (trimmed === '') return 'Escribí un nombre para este equipo.'
    if (trimmed.length > MAX_TEAM_NAME_LENGTH) return `Máximo ${MAX_TEAM_NAME_LENGTH} caracteres.`
    if (normalized.indexOf(normalized[index]) !== index) return 'Ya hay un equipo con este nombre.'
    return null
  })

  return { count, names: errors }
}

export function isValid(errors: TeamNamesErrors): boolean {
  return errors.count === null && errors.names.every((error) => error === null)
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'selectMode':
      if (state.phase !== 'menu') return state
      return { ...state, phase: 'setup', mode: action.mode }

    case 'startSession': {
      // La validación se repite acá para que ningún llamador pueda dejar la sesión inconsistente.
      if (state.phase !== 'setup' || !isValid(validateTeamNames(action.names)) || !action.sessionId) return state
      const teams = action.names.map((name, index) => ({
        id: `team-${index + 1}`,
        name: name.trim(),
        score: 0,
      }))
      return { ...state, sessionId: action.sessionId, phase: 'playing', teams, activeTeamId: teams[0].id, gameIndex: 0 }
    }

    case 'addPoints': {
      if (state.phase !== 'playing' || !Number.isInteger(action.points)) return state
      if (!state.teams.some((team) => team.id === action.teamId)) return state
      return {
        ...state,
        teams: state.teams.map((team) =>
          team.id === action.teamId ? { ...team, score: team.score + action.points } : team,
        ),
      }
    }

    case 'nextTurn': {
      if (state.phase !== 'playing' || state.teams.length === 0) return state
      const current = state.teams.findIndex((team) => team.id === state.activeTeamId)
      const next = state.teams[(current + 1) % state.teams.length]
      return { ...state, activeTeamId: next.id }
    }

    case 'finishGame':
      // Solo desde 'playing': un segundo finishGame del mismo juego no tiene efecto.
      if (state.phase !== 'playing') return state
      if (isLastGame(state)) return { ...state, phase: 'results', activeTeamId: null }
      return { ...state, phase: 'intermission' }

    case 'nextGame': {
      if (state.phase !== 'intermission' || isLastGame(state)) return state
      // Los puntajes se conservan; el turno sigue la rotación con el equipo siguiente al último que jugó.
      const current = state.teams.findIndex((team) => team.id === state.activeTeamId)
      const next = state.teams[(current + 1) % state.teams.length]
      return { ...state, phase: 'playing', gameIndex: state.gameIndex + 1, activeTeamId: next.id }
    }

    case 'backToMenu':
      return initialSessionState
  }
}

export function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const GAME_IDS: GameId[] = ['roulette', 'memory', 'location']

// Valida una sesión guardada. Solo se aceptan partidas en curso ('playing' o 'intermission')
// que cumplan las mismas reglas que impone el reducer; cualquier otra cosa devuelve null.
export function parseSavedSession(raw: unknown): SessionState | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { sessionId, phase, mode, teams, activeTeamId, gameIndex } = raw as Record<string, unknown>
  if (typeof sessionId !== 'string' || sessionId === '') return null
  if (phase !== 'playing' && phase !== 'intermission') return null

  let parsedMode: GameMode
  const m = (mode ?? {}) as Record<string, unknown>
  if (m.kind === 'challenge') parsedMode = { kind: 'challenge' }
  else if (m.kind === 'single' && GAME_IDS.includes(m.game as GameId)) parsedMode = { kind: 'single', game: m.game as GameId }
  else return null

  if (!Number.isInteger(gameIndex)) return null
  const index = gameIndex as number
  if (parsedMode.kind === 'single' && (index !== 0 || phase !== 'playing')) return null
  // En la pausa, gameIndex es el juego que acaba de terminar: nunca puede ser el último.
  const maxIndex = phase === 'intermission' ? CHALLENGE_ORDER.length - 2 : CHALLENGE_ORDER.length - 1
  if (parsedMode.kind === 'challenge' && (index < 0 || index > maxIndex)) return null

  if (!Array.isArray(teams)) return null
  const parsedTeams: Team[] = []
  for (const [i, team] of teams.entries()) {
    const { id, name, score } = (team ?? {}) as Record<string, unknown>
    if (id !== `team-${i + 1}` || typeof name !== 'string' || !Number.isInteger(score)) return null
    parsedTeams.push({ id, name, score: score as number })
  }
  if (!isValid(validateTeamNames(parsedTeams.map((team) => team.name)))) return null
  if (!parsedTeams.some((team) => team.id === activeTeamId)) return null

  return {
    sessionId,
    phase,
    mode: parsedMode,
    teams: parsedTeams,
    activeTeamId: activeTeamId as string,
    gameIndex: index,
  }
}

// Ranking para resultados: mayor puntaje primero; los empates comparten posición.
export function rankTeams(teams: Team[]): { team: Team; position: number }[] {
  const sorted = [...teams].sort((a, b) => b.score - a.score)
  return sorted.map((team) => ({
    team,
    position: sorted.findIndex((other) => other.score === team.score) + 1,
  }))
}
