// Lógica pura del sorteo de colegios (sin React) para poder verificarla de forma aislada.
// Es independiente de los juegos y de la sesión de equipos.

export type School = { code: string; name: string }

// Valida la lista; descarta entradas mal formadas o con código repetido.
export function parseSchools(raw: unknown): { schools: School[]; rejected: number } {
  const items = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const schools: School[] = []
  for (const item of items) {
    const { code, name } = (item ?? {}) as Record<string, unknown>
    if (typeof code !== 'string' || code.trim() === '' || typeof name !== 'string' || name.trim() === '') continue
    if (seen.has(code)) continue
    seen.add(code)
    schools.push({ code, name: name.trim() })
  }
  return { schools, rejected: items.length - schools.length }
}

export function remainingSchools(schools: School[], winnerCodes: string[]): School[] {
  return schools.filter((school) => !winnerCodes.includes(school.code))
}

// Elige un colegio al azar entre los que todavía no ganaron. `random` en [0, 1).
export function drawSchool(schools: School[], winnerCodes: string[], random: number): School | null {
  const remaining = remainingSchools(schools, winnerCodes)
  if (remaining.length === 0) return null
  const index = Math.min(remaining.length - 1, Math.floor(Math.max(0, random) * remaining.length))
  return remaining[index]
}

// Aleatorio uniforme con el generador criptográfico del navegador (más parejo que Math.random).
export function fairRandom(): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] / 2 ** 32
}

// Contraseña para entrar al sorteo. Es solo una barrera para el público en la exposición:
// queda dentro de la app, así que no es una protección de seguridad real.
export const RAFFLE_PASSWORD = '1379'

// --- Ganadores guardados (sessionStorage): sobreviven a una recarga accidental de la pestaña. ---
const STORAGE_KEY = 'godoy-cruz-expo/sorteo'

export function loadWinners(validCodes: string[]): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(raw)) return []
    return [...new Set(raw.filter((code): code is string => typeof code === 'string' && validCodes.includes(code)))]
  } catch {
    return []
  }
}

export function saveWinners(codes: string[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(codes))
  } catch {
    // Sin almacenamiento disponible: el sorteo sigue funcionando sin recuperación.
  }
}
