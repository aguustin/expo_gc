// Proyección del mapa local (funciones puras, sin datos). Coordenadas del mapa en metros:
// x hacia el este, y hacia el sur, con origen en (lat0, lon0). La misma proyección se usa para
// dibujar el mapa (scripts/build-map.mjs) y para convertir un clic en lat/lon.
import type { GeoPoint } from './locationLogic.ts'

export type MapProjection = { lat0: number; lon0: number; metersPerDegLat: number; metersPerDegLon: number }

export function toMapPoint(point: GeoPoint, projection: MapProjection): { x: number; y: number } {
  return {
    x: (point.lon - projection.lon0) * projection.metersPerDegLon,
    y: (projection.lat0 - point.lat) * projection.metersPerDegLat,
  }
}

export function fromMapPoint(x: number, y: number, projection: MapProjection): GeoPoint {
  return {
    lat: projection.lat0 - y / projection.metersPerDegLat,
    lon: projection.lon0 + x / projection.metersPerDegLon,
  }
}

// Zona de juego: los lugares del catálogo más un margen. Se usa como viewBox; con
// preserveAspectRatio "meet" el resto del mapa llena el espacio sobrante de la pantalla.
export function focusBox(points: GeoPoint[], projection: MapProjection, margin = 500) {
  const projected = points.map((p) => toMapPoint(p, projection))
  const xs = projected.map((p) => p.x)
  const ys = projected.map((p) => p.y)
  const minX = Math.min(...xs) - margin
  const minY = Math.min(...ys) - margin
  return { minX, minY, width: Math.max(...xs) + margin - minX, height: Math.max(...ys) + margin - minY }
}

// --- Vista del mapa (zoom y desplazamiento) ---
// La vista es el viewBox del SVG, en metros, siempre con la misma proporción que el contenedor:
// así cada píxel corresponde a la misma distancia en ambos ejes y el zoom es lineal.

export type Box = { minX: number; minY: number; width: number; height: number }
export type MapView = { x: number; y: number; w: number; h: number }

// Acercamiento máximo respecto de la vista completa (8× ≈ 1 m por píxel en un TV 1080p).
export const MAX_ZOOM = 8

// Caja centrada en `box`, agrandada lo justo para tener la proporción `aspect` (ancho / alto).
export function fitBox(box: Box, aspect: number): MapView {
  let w = box.width
  let h = box.height
  if (w / h < aspect) w = h * aspect
  else h = w / aspect
  return { x: box.minX + box.width / 2 - w / 2, y: box.minY + box.height / 2 - h / 2, w, h }
}

export function zoomLevel(view: MapView, home: MapView): number {
  return home.w / view.w
}

// Mantiene el zoom entre la vista completa y MAX_ZOOM, y el centro dentro de la zona con datos.
export function clampView(view: MapView, home: MapView, extent: { minX: number; minY: number; maxX: number; maxY: number }): MapView {
  const w = Math.min(home.w, Math.max(home.w / MAX_ZOOM, view.w))
  const h = w * (home.h / home.w)
  const minX = Math.min(extent.minX, home.x)
  const maxX = Math.max(extent.maxX, home.x + home.w)
  const minY = Math.min(extent.minY, home.y)
  const maxY = Math.max(extent.maxY, home.y + home.h)
  const clamp = (value: number, low: number, high: number) => (low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value)))
  const cx = clamp(view.x + view.w / 2, minX + w / 2, maxX - w / 2)
  const cy = clamp(view.y + view.h / 2, minY + h / 2, maxY - h / 2)
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

// Acerca (factor > 1) o aleja (factor < 1) dejando fijo el punto que está en la fracción (fx, fy)
// de la vista, p. ej. el que está bajo el cursor. Respeta los límites de zoom.
export function zoomAt(view: MapView, factor: number, fx: number, fy: number, home: MapView): MapView {
  const w = Math.min(home.w, Math.max(home.w / MAX_ZOOM, view.w / factor))
  const h = w * (view.h / view.w)
  const px = view.x + fx * view.w
  const py = view.y + fy * view.h
  return { x: px - fx * w, y: py - fy * h, w, h }
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}
