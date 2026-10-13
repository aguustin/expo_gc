// El color de cada equipo depende de su posición (tokens --color-team-1..4 en index.css).
export function teamColor(index: number): string {
  return `var(--color-team-${index + 1})`
}
