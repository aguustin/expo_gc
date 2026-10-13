import type { Team } from '../state/session.ts'
import { teamColor } from './teamColor.ts'

type ScoreboardProps = {
  teams: Team[]
  activeTeamId: string | null
}

// Marcador de solo lectura: muestra el estado compartido de la sesión, no guarda puntajes propios.
export function Scoreboard({ teams, activeTeamId }: ScoreboardProps) {
  return (
    <ol className="grid gap-4" style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}>
      {teams.map((team, index) => {
        const isActive = team.id === activeTeamId
        return (
          <li
            key={team.id}
            className={`bg-surface relative rounded-3xl border-4 px-6 py-4 transition ${isActive ? 'scale-[1.03]' : 'opacity-75'}`}
            style={{ borderColor: isActive ? teamColor(index) : 'transparent' }}
            aria-current={isActive ? 'true' : undefined}
          >
            {isActive && (
              <span
                className="text-night absolute -top-4 left-6 rounded-full px-3 py-0.5 text-sm font-black uppercase"
                style={{ backgroundColor: teamColor(index) }}
              >
                Turno
              </span>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="truncate text-2xl font-extrabold" style={{ color: teamColor(index) }}>
                {team.name}
              </p>
              <p className="font-display text-4xl tabular-nums">{team.score}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
