import type { GameId } from '../state/session.ts'

export type GameInfo = {
  id: GameId
  title: string
  description: string
  icon: string
  // Cambiar a true cuando el juego esté implementado y conectado al marcador.
  available: boolean
}

export const GAMES: GameInfo[] = [
  {
    id: 'roulette',
    title: 'Ruleta de preguntas',
    description: 'Girá la ruleta y respondé preguntas sobre Godoy Cruz.',
    icon: '🎡',
    available: true,
  },
  {
    id: 'memory',
    title: 'Juego de memoria',
    description: 'Encontrá los pares de lugares y personajes del departamento.',
    icon: '🧠',
    available: true,
  },
  {
    id: 'location',
    title: '¿Dónde queda?',
    description: 'Reconocé lugares de Godoy Cruz por su foto o ubicalos en el mapa.',
    icon: '📍',
    available: true,
  },
]

// Desafío completo: los tres juegos seguidos (orden en CHALLENGE_ORDER de la sesión).
export const CHALLENGE_AVAILABLE = true

export function getGame(id: GameId): GameInfo {
  return GAMES.find((game) => game.id === id)!
}
