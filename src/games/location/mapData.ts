// Mapa local de Godoy Cruz (generado con scripts/build-map.mjs a partir de OpenStreetMap).
// Carga y valida el archivo; la proyección está en mapProjection.ts.
import rawMap from '../../data/godoy-cruz-map.json'
import { isRecord } from '../../state/validation.ts'
import type { MapProjection } from './mapProjection.ts'

// level: 1 avenidas (siempre visibles), 2 calles principales y 3 calles de barrio (visibles al acercar).
export type MapLabel = { name: string; x: number; y: number; angle: number; level?: number }
export type MapData = {
  attribution: string
  license: string
  osmTimestamp: string | null
  projection: MapProjection
  extent: { minX: number; minY: number; maxX: number; maxY: number }
  layers: Record<'parks' | 'canals' | 'rail' | 'minor' | 'medium' | 'major', string>
  labels: MapLabel[]
}

const LAYERS = ['parks', 'canals', 'rail', 'minor', 'medium', 'major'] as const

function parseMap(raw: unknown): MapData | null {
  if (!isRecord(raw) || !isRecord(raw.projection) || !isRecord(raw.extent) || !isRecord(raw.layers)) return null
  const { lat0, lon0, metersPerDegLat, metersPerDegLon } = raw.projection
  const numbers = [lat0, lon0, metersPerDegLat, metersPerDegLon, raw.extent.minX, raw.extent.minY, raw.extent.maxX, raw.extent.maxY]
  if (!numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) return null
  if ((metersPerDegLat as number) <= 0 || (metersPerDegLon as number) <= 0) return null
  const layers = raw.layers
  if (!LAYERS.every((key) => typeof layers[key] === 'string') || (layers.minor as string).length === 0) return null
  if (typeof raw.attribution !== 'string' || raw.attribution === '') return null
  return raw as unknown as MapData
}

// null si el archivo del mapa falta o está dañado: la modalidad de mapa queda deshabilitada.
export const MAP_DATA = parseMap(rawMap)
