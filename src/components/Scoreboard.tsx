import type { Team } from '../state/session.ts'
import { teamColor } from './teamColor.ts'

type ScoreboardProps = {
  teams: Team[]
  activeTeamId: string | null
}

// Marcador de solo lectura: muestra el estado compartido de la sesión, no guarda puntajes propios.
// El equipo con turno se eleva (más sombra y desplazamiento) y lleva la etiqueta «Turno»:
// el estado no depende solo del color.
export function Scoreboard({ teams, activeTeamId }: ScoreboardProps) {
  return (
    <ol className="grid gap-4" style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}>
      {teams.map((team, index) => {
        const isActive = team.id === activeTeamId
        const color = teamColor(index)
        return (
          <li
            key={team.id}
            className={`relative overflow-hidden rounded-[var(--radius-control)] border bg-white px-5 py-3 transition-[transform,box-shadow] duration-300 ease-[var(--ease-soft)] ${
              isActive ? 'border-transparent -translate-y-1 shadow-[var(--shadow-elev-3)]' : 'border-line shadow-[var(--shadow-elev-1)]'
            }`}
            style={isActive ? { boxShadow: `0 0 0 3px ${color}, var(--shadow-elev-3)` } : undefined}
            aria-current={isActive ? 'true' : undefined}
          >
            {/* Franja de color del equipo a la izquierda. */}
            <span className="absolute inset-y-0 left-0 w-2" style={{ backgroundColor: color }} aria-hidden="true" />
            <div className="flex items-center justify-between gap-4 pl-2">
              <div className="min-w-0">
                <p className="truncate text-2xl font-bold" style={{ color }}>
                  {team.name}
                </p>
                {/* El espacio se reserva siempre para que el marcador no salte al rotar el turno. */}
                <span className="text-ink-2 block text-sm font-bold tracking-wide uppercase">{isActive ? '● Turno' : ' '}</span>
              </div>
              <p className="font-display text-ink text-4xl font-extrabold tabular-nums">{team.score}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
