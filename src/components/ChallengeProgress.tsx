import { getGame } from '../games/catalog.ts'
import { CHALLENGE_ORDER } from '../state/session.ts'
import { GAME_ICONS } from './gameIcons.ts'
import { Icon } from './Icon.tsx'

type ChallengeProgressProps = {
  // Índice del juego en curso, o del último terminado si `currentDone` es true.
  gameIndex: number
  currentDone: boolean
  compact?: boolean
}

// Etapas del desafío completo: hechas (✓), actual (elevada, en magenta) y pendientes (planas).
export function ChallengeProgress({ gameIndex, currentDone, compact = false }: ChallengeProgressProps) {
  return (
    <ol className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`} aria-label="Progreso del desafío">
      {CHALLENGE_ORDER.map((id, index) => {
        const done = index < gameIndex || (index === gameIndex && currentDone)
        const current = index === gameIndex && !currentDone
        const game = getGame(id)
        return (
          <li key={id} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
            {index > 0 && (
              <span
                className={`h-1 rounded-full ${compact ? 'w-5' : 'w-10'} ${index <= gameIndex ? 'bg-accent' : 'bg-line'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`flex items-center gap-2 rounded-full font-bold transition-[transform,box-shadow] duration-300 ${
                compact ? 'px-3 py-1.5 text-base' : 'px-5 py-2.5 text-xl'
              } ${
                current
                  ? 'bg-accent -translate-y-0.5 text-white shadow-[0_3px_0_var(--color-accent-deep),var(--shadow-elev-2)]'
                  : done
                    ? 'bg-accent-soft text-accent-strong border-accent-line border'
                    : 'border-line text-muted border bg-white'
              }`}
            >
              <span className={`grid place-items-center rounded-full ${compact ? 'h-6 w-6' : 'h-8 w-8'} ${current ? 'bg-white/20' : done ? 'bg-accent text-white' : 'bg-surface-3'}`}>
                {done ? (
                  <Icon name="check" className={compact ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={3} />
                ) : (
                  <Icon name={GAME_ICONS[id]} className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
                )}
              </span>
              <span className="whitespace-nowrap">
                {compact ? `${index + 1}. ` : `${index + 1}. ${game.title}`}
                {compact && <span className="sr-only">{game.title}</span>}
              </span>
              <span className="sr-only">{done ? '(completado)' : current ? '(en curso)' : '(pendiente)'}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
