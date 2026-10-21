import type { GameId } from '../state/session.ts'
import type { IconName } from './Icon.tsx'

// Ícono SVG de cada juego (reemplaza a los emojis del catálogo, que dependían del sistema).
export const GAME_ICONS: Record<GameId, IconName> = {
  roulette: 'wheel',
  memory: 'cards',
  location: 'pin',
}
