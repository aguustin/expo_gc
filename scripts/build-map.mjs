// Genera el mapa local de «¿Dónde queda?» a partir de datos de OpenStreetMap.
// Se ejecuta una sola vez (o al querer actualizar la cartografía), nunca durante la exposición:
//
//   node scripts/build-map.mjs                 # descarga de Overpass y genera
//   node scripts/build-map.mjs datos-osm.json  # usa una descarga previa (respuesta JSON de Overpass)
//
// Salida: src/data/godoy-cruz-map.json (trazados ya proyectados en metros + parámetros de proyección).
// Datos © colaboradores de OpenStreetMap, licencia ODbL 1.0 (https://www.openstreetmap.org/copyright).
import { readFileSync, writeFileSync } from 'node:fs'

// Área descargada (más amplia que la zona de juego para llenar pantallas de cualquier proporción).
const BBOX = { south: -32.965, west: -68.905, north: -32.89, east: -68.785 }

// Centro de la proyección: zona de los ocho lugares.
const LAT0 = -32.9275
const LON0 = -68.8467
// Metros por grado a la latitud de Godoy Cruz (aproximación WGS84; error < 1 m en esta zona).
const RAD = Math.PI / 180
const M_PER_DEG_LAT = 111132.92 - 559.82 * Math.cos(2 * LAT0 * RAD) + 1.175 * Math.cos(4 * LAT0 * RAD)
const M_PER_DEG_LON = 111412.84 * Math.cos(LAT0 * RAD) - 93.5 * Math.cos(3 * LAT0 * RAD)

const QUERY = `[out:json][timeout:120];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|residential|unclassified|living_street)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["railway"~"^(rail|abandoned|disused|light_rail)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["waterway"="canal"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
  way["leisure"="park"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
);
out geom qt;`

async function loadOsm() {
  const input = process.argv[2]
  if (input) return JSON.parse(readFileSync(input, 'utf8'))
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'User-Agent': 'GodoyCruzExpoMapBuilder/1.0 (one-time offline map extract)' },
    body: new URLSearchParams({ data: QUERY }),
  })
  if (!response.ok) throw new Error(`Overpass respondió ${response.status}`)
  return response.json()
}

const project = ({ lat, lon }) => [(lon - LON0) * M_PER_DEG_LON, (LAT0 - lat) * M_PER_DEG_LAT]

// Douglas-Peucker: reduce puntos sin cambiar la forma a la escala del mapa.
function simplify(points, tolerance) {
  if (points.length < 3) return points
  const [ax, ay] = points[0]
  const [bx, by] = points.at(-1)
  const length = Math.hypot(bx - ax, by - ay) || 1
  let maxDistance = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length
    if (distance > maxDistance) [maxDistance, index] = [distance, i]
  }
  if (maxDistance <= tolerance) return [points[0], points.at(-1)]
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)]
}

const toPath = (points, close = false) =>
  'M' + points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L') + (close ? 'Z' : '')

const ROAD_CLASS = {
  motorway: 'major', trunk: 'major', primary: 'major', motorway_link: 'major', trunk_link: 'major', primary_link: 'major',
  secondary: 'medium', tertiary: 'medium', secondary_link: 'medium', tertiary_link: 'medium',
  residential: 'minor', unclassified: 'minor', living_street: 'minor',
}

const osm = await loadOsm()
const layers = { parks: [], canals: [], rail: [], minor: [], medium: [], major: [] }
const namedLengths = new Map()

for (const element of osm.elements) {
  if (element.type !== 'way' || !element.geometry) continue
  const tags = element.tags ?? {}
  const points = simplify(element.geometry.map(project), 2)
  if (tags.leisure === 'park') layers.parks.push(toPath(points, true))
  else if (tags.waterway === 'canal') layers.canals.push(toPath(points))
  else if (tags.railway) layers.rail.push(toPath(points))
  else if (ROAD_CLASS[tags.highway]) {
    const roadClass = ROAD_CLASS[tags.highway]
    layers[roadClass].push(toPath(points))
    // Candidatos a etiqueta: toda calle con nombre (las de barrio solo se muestran con zoom).
    if (tags.name && !tags.highway.endsWith('_link')) {
      const length = points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0)
      const entry = namedLengths.get(tags.name) ?? { total: 0, longest: null, longestLength: 0, roadClass }
      entry.total += length
      if (length > entry.longestLength) Object.assign(entry, { longest: points, longestLength: length })
      namedLengths.set(tags.name, entry)
    }
  }
}

// Etiquetas en tres niveles: 1 avenidas (siempre visibles), 2 calles principales y 3 calles de barrio
// (visibles al acercar). Cada nivel tiene su separación mínima en metros, pensada para la escala
// a la que aparece, y se ubica en el punto medio del tramo más largo de cada calle.
const LEVELS = {
  1: { classes: ['major', 'medium'], minTotal: 1200, minLongest: 300, spacing: 900, max: 40 },
  2: { classes: ['medium'], minTotal: 500, minLongest: 150, spacing: 400, max: 150 },
  3: { classes: ['minor'], minTotal: 150, minLongest: 100, spacing: 220, max: 900 },
}
const CLASS_ORDER = { major: 0, medium: 1, minor: 2 }
const labels = []
for (const [level, rule] of Object.entries(LEVELS)) {
  const candidates = [...namedLengths.entries()]
    .filter(([, entry]) => rule.classes.includes(entry.roadClass) && entry.total > rule.minTotal && entry.longestLength > rule.minLongest)
    .sort((a, b) => CLASS_ORDER[a[1].roadClass] - CLASS_ORDER[b[1].roadClass] || b[1].total - a[1].total)
  let placed = 0
  for (const [name, entry] of candidates) {
    if (labels.some((label) => label.name === name)) continue
    const points = entry.longest
    let walked = 0
    let at = null
    for (let i = 1; i < points.length && !at; i++) {
      const segment = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
      if (walked + segment >= entry.longestLength / 2) {
        const t = (entry.longestLength / 2 - walked) / segment
        const [x0, y0] = points[i - 1]
        const [x1, y1] = points[i]
        let angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI
        if (angle > 90) angle -= 180
        if (angle < -90) angle += 180
        at = { x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t), angle: Math.round(angle) }
      }
      walked += segment
    }
    if (at && labels.every((label) => Math.hypot(label.x - at.x, label.y - at.y) > rule.spacing)) {
      labels.push({ name, ...at, level: Number(level) })
      if (++placed >= rule.max) break
    }
  }
}

const [minX, minY] = project({ lat: BBOX.north, lon: BBOX.west })
const [maxX, maxY] = project({ lat: BBOX.south, lon: BBOX.east })

const map = {
  attribution: '© colaboradores de OpenStreetMap',
  license: 'ODbL 1.0 — https://www.openstreetmap.org/copyright',
  osmTimestamp: osm.osm3s?.timestamp_osm_base ?? null,
  projection: { lat0: LAT0, lon0: LON0, metersPerDegLat: M_PER_DEG_LAT, metersPerDegLon: M_PER_DEG_LON },
  // Extensión de los datos en metros (x hacia el este, y hacia el sur, origen en el centro de la proyección).
  extent: { minX: Math.round(minX), minY: Math.round(minY), maxX: Math.round(maxX), maxY: Math.round(maxY) },
  layers: Object.fromEntries(Object.entries(layers).map(([key, paths]) => [key, paths.join('')])),
  labels,
}
writeFileSync(new URL('../src/data/godoy-cruz-map.json', import.meta.url), JSON.stringify(map))
console.log(
  `Mapa generado: ${Object.entries(layers).map(([key, paths]) => `${key}=${paths.length}`).join(', ')}, etiquetas=${[1, 2, 3].map((l) => labels.filter((x) => x.level === l).length).join('/')} (avenidas/principales/barrio)`,
)
