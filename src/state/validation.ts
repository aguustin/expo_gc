// Validadores mínimos para datos restaurados desde el almacenamiento (desconocidos por definición).

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isUniqueStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') && new Set(value).size === value.length
}

export function isIndex(value: unknown, length: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < length
}

export function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
