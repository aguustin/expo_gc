// Lógica pura de la ruleta (sin React) para poder verificarla de forma aislada.
// Cada evento devuelve el nuevo estado local y las acciones de sesión que el componente
// debe despachar. Los puntajes y el turno viven solo en la sesión; acá no se duplican.
import type { SessionAction } from '../../state/session.ts'

export const MAX_QUESTIONS_PER_GAME = 12
export const POINTS_PER_CORRECT_ANSWER = 100
export const ANSWER_TIME_MS = 30_000

export type RouletteQuestion = {
  id: string
  question: string
  options: string[]
  correctOption: number
}

export type Outcome = 'correct' | 'wrong' | 'timeout'

// idle → spinning → answering → revealed → (idle | finished)
export type RoulettePhase = 'idle' | 'spinning' | 'answering' | 'revealed' | 'finished'

export type RouletteState = {
  pool: RouletteQuestion[]
  total: number
  phase: RoulettePhase
  usedIds: string[]
  current: RouletteQuestion | null
  deadline: number | null
  selectedOption: number | null
  outcome: Outcome | null
  // Equipo que tenía el turno al resolverse la pregunta (solo para mostrar el resultado).
  answeredBy: string | null
  resolvedCount: number
}

export type RouletteEvent =
  | { type: 'spin'; random: number }
  | { type: 'spinEnd'; now: number }
  | { type: 'answer'; option: number; teamId: string | null; now: number }
  | { type: 'timeout'; teamId: string | null; now: number }
  | { type: 'continue' }

export type RouletteStep = {
  state: RouletteState
  effects: SessionAction[]
}

// Descarta entradas mal formadas o con id repetido para que el juego nunca falle por los datos.
export function parseQuestions(raw: unknown): { questions: RouletteQuestion[]; rejected: number } {
  const items = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const questions: RouletteQuestion[] = []
  for (const item of items) {
    const { id, question, options, correctOption } = (item ?? {}) as Record<string, unknown>
    const valid =
      typeof id === 'string' &&
      id.trim() !== '' &&
      !seen.has(id) &&
      typeof question === 'string' &&
      question.trim() !== '' &&
      Array.isArray(options) &&
      options.length >= 2 &&
      options.every((option) => typeof option === 'string' && option.trim() !== '') &&
      Number.isInteger(correctOption) &&
      (correctOption as number) >= 0 &&
      (correctOption as number) < options.length
    if (!valid) continue
    seen.add(id)
    questions.push({ id, question, options: options as string[], correctOption: correctOption as number })
  }
  return { questions, rejected: items.length - questions.length }
}

export function createRouletteState(pool: RouletteQuestion[]): RouletteState {
  return {
    pool,
    total: Math.min(MAX_QUESTIONS_PER_GAME, pool.length),
    phase: 'idle',
    usedIds: [],
    current: null,
    deadline: null,
    selectedOption: null,
    outcome: null,
    answeredBy: null,
    resolvedCount: 0,
  }
}

export function availableQuestions(state: RouletteState): RouletteQuestion[] {
  return state.pool.filter((question) => !state.usedIds.includes(question.id))
}

// Segmentos visibles: las preguntas disponibles más la que está en juego.
export function wheelQuestions(state: RouletteState): RouletteQuestion[] {
  return state.pool.filter((question) => !state.usedIds.includes(question.id) || question.id === state.current?.id)
}

const unchanged = (state: RouletteState): RouletteStep => ({ state, effects: [] })

export function rouletteStep(state: RouletteState, event: RouletteEvent): RouletteStep {
  switch (event.type) {
    case 'spin': {
      if (state.phase !== 'idle' || state.resolvedCount >= state.total) return unchanged(state)
      const available = availableQuestions(state)
      if (available.length === 0) return unchanged(state)
      const index = Math.min(available.length - 1, Math.floor(Math.max(0, event.random) * available.length))
      const current = available[index]
      // Se marca como usada al salir sorteada: no puede repetirse aunque la pregunta no llegue a resolverse.
      return {
        state: { ...state, phase: 'spinning', current, usedIds: [...state.usedIds, current.id] },
        effects: [],
      }
    }

    case 'spinEnd':
      if (state.phase !== 'spinning') return unchanged(state)
      return { state: { ...state, phase: 'answering', deadline: event.now + ANSWER_TIME_MS }, effects: [] }

    case 'answer': {
      if (state.phase !== 'answering' || !state.current || event.teamId === null) return unchanged(state)
      if (!Number.isInteger(event.option) || event.option < 0 || event.option >= state.current.options.length) {
        return unchanged(state)
      }
      // Una respuesta que llega con el tiempo vencido cuenta como tiempo agotado.
      if (state.deadline !== null && event.now >= state.deadline) {
        return rouletteStep(state, { type: 'timeout', teamId: event.teamId, now: event.now })
      }
      const correct = event.option === state.current.correctOption
      return {
        state: {
          ...state,
          phase: 'revealed',
          selectedOption: event.option,
          outcome: correct ? 'correct' : 'wrong',
          answeredBy: event.teamId,
          resolvedCount: state.resolvedCount + 1,
        },
        effects: correct ? [{ type: 'addPoints', teamId: event.teamId, points: POINTS_PER_CORRECT_ANSWER }] : [],
      }
    }

    case 'timeout':
      if (state.phase !== 'answering' || state.deadline === null || event.now < state.deadline) {
        return unchanged(state)
      }
      return {
        state: {
          ...state,
          phase: 'revealed',
          selectedOption: null,
          outcome: 'timeout',
          answeredBy: event.teamId,
          resolvedCount: state.resolvedCount + 1,
        },
        effects: [],
      }

    case 'continue': {
      if (state.phase !== 'revealed') return unchanged(state)
      const cleared = { ...state, current: null, deadline: null, selectedOption: null, outcome: null, answeredBy: null }
      const isOver = state.resolvedCount >= state.total || availableQuestions(state).length === 0
      if (isOver) return { state: { ...cleared, phase: 'finished' }, effects: [{ type: 'finishGame' }] }
      return { state: { ...cleared, phase: 'idle' }, effects: [{ type: 'nextTurn' }] }
    }
  }
}
