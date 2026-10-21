import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { Icon, type IconName } from '../../components/Icon.tsx'
import { MAP_TOLERANCE_METERS, type GeoPoint, type Outcome, type Place } from './locationLogic.ts'
import type { MapData } from './mapData.ts'
import {
  clampView,
  fitBox,
  focusBox,
  fromMapPoint,
  MAX_ZOOM,
  toMapPoint,
  zoomAt,
  zoomLevel,
  type MapView,
} from './mapProjection.ts'

type LocationMapProps = {
  map: MapData
  // Lugares que definen la vista completa (todos los del catálogo, para no delatar el actual).
  focusPoints: GeoPoint[]
  interactive: boolean
  pending: GeoPoint | null
  onPick: (point: GeoPoint) => void
  // Solo después de resolver: lugar correcto, punto elegido y resultado.
  reveal: { target: Place; selected: GeoPoint | null; outcome: Outcome; distance: number | null } | null
  markerColor: string
}

const COLORS = {
  land: '#eee8da',
  park: '#bfe0a6',
  canal: '#5aa9de',
  rail: '#8c8c8c',
  minor: '#ffffff',
  medium: '#ffe39a',
  major: '#f5a65b',
  casing: '#b9ad97',
  label: '#2b2b2b',
  correct: '#13723a',
}

// Movimiento mínimo (px) para que un toque se considere arrastre y no marque un punto.
const DRAG_THRESHOLD_PX = 10
// Zoom a partir del cual se muestran los nombres de cada nivel (1 avenidas, 2 principales, 3 de barrio).
const LABEL_MIN_ZOOM: Record<number, number> = { 1: 1, 2: 2.5, 3: 4.5 }
const LABEL_FONT_PX: Record<number, number> = { 1: 17, 2: 16, 3: 15 }
const BUTTON_ZOOM_STEP = 1.6

type Gesture = { startView: MapView; start: Map<number, { x: number; y: number }>; moved: boolean }

export function LocationMap({ map, focusPoints, interactive, pending, onPick, reveal, markerColor }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  // null = vista completa. La vista vive solo en pantalla: no afecta la lógica ni se guarda.
  const [view, setView] = useState<MapView | null>(null)
  const { projection, extent, layers } = map

  const home = fitBox(focusBox(focusPoints, projection), size ? size.width / size.height : 16 / 10)
  const current = view ?? home
  const zoom = zoomLevel(current, home)
  const pxPerMeter = size ? size.width / current.w : 0.1
  const px = (pixels: number) => pixels / pxPerMeter

  // Referencias a los valores actuales para los manejadores nativos (rueda) y los gestos.
  const homeRef = useRef(home)
  const viewRef = useRef(current)
  homeRef.current = home
  viewRef.current = current
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setSize({ width, height })
        setView(null) // Al cambiar el tamaño se vuelve a la vista completa.
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Al resolver, se acerca a la marca y al lugar correcto para ver el resultado de cerca.
  const revealKey = reveal ? `${reveal.target.id}|${reveal.selected?.lat}|${reveal.selected?.lon}` : ''
  useEffect(() => {
    if (!reveal || !size) return
    const points = [reveal.target, ...(reveal.selected ? [reveal.selected] : [])].map((p) => toMapPoint(p, projection))
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    const pad = Math.max(MAP_TOLERANCE_METERS * 2, span * 0.35)
    const box = {
      minX: Math.min(...xs) - pad,
      minY: Math.min(...ys) - pad,
      width: Math.max(...xs) - Math.min(...xs) + pad * 2,
      height: Math.max(...ys) - Math.min(...ys) + pad * 2,
    }
    setView(clampView(fitBox(box, size.width / size.height), homeRef.current, extent))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealKey resume los datos de reveal
  }, [revealKey, size, extent, projection])

  // Rueda del mouse: zoom centrado en el cursor. Listener nativo para poder evitar el scroll de la página.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = svg.getBoundingClientRect()
      const fx = (event.clientX - rect.left) / rect.width
      const fy = (event.clientY - rect.top) / rect.height
      const factor = Math.pow(1.0015, -event.deltaY)
      setView(clampView(zoomAt(viewRef.current, factor, fx, fy, homeRef.current), homeRef.current, extent))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [extent])

  function zoomFromCenter(factor: number) {
    setView(clampView(zoomAt(current, factor, 0.5, 0.5, home), home, extent))
  }

  // Posición en pantalla → coordenadas del mapa → lat/lon. getScreenCTM refleja el zoom y el
  // desplazamiento actuales, así que la conversión es exacta con cualquier vista.
  function pick(clientX: number, clientY: number) {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse())
    onPick(fromMapPoint(p.x, p.y, projection))
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    // Con dos dedos empieza un pellizco: ese gesto nunca marca un punto.
    gesture.current = { startView: viewRef.current, start: new Map(pointers.current), moved: pointers.current.size > 1 }
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const g = gesture.current
    if (!g || !pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const rect = event.currentTarget.getBoundingClientRect()
    const metersPerPx = g.startView.w / rect.width

    if (pointers.current.size === 1) {
      const start = g.start.get(event.pointerId)
      if (!start) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!g.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      g.moved = true
      setView(clampView({ ...g.startView, x: g.startView.x - dx * metersPerPx, y: g.startView.y - dy * metersPerPx }, home, extent))
      return
    }

    // Pellizco: zoom según la distancia entre dedos, centrado en el punto medio inicial.
    const ids = [...pointers.current.keys()].slice(0, 2)
    const [a0, b0] = ids.map((id) => g.start.get(id))
    const [a, b] = ids.map((id) => pointers.current.get(id)!)
    if (!a0 || !b0) return
    const startDistance = Math.hypot(b0.x - a0.x, b0.y - a0.y) || 1
    const factor = Math.hypot(b.x - a.x, b.y - a.y) / startDistance
    const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const zoomed = zoomAt(g.startView, factor, (mid0.x - rect.left) / rect.width, (mid0.y - rect.top) / rect.height, home)
    const scale = zoomed.w / rect.width
    setView(clampView({ ...zoomed, x: zoomed.x - (mid.x - mid0.x) * scale, y: zoomed.y - (mid.y - mid0.y) * scale }, home, extent))
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    const g = gesture.current
    const isTap = g !== null && !g.moved && pointers.current.size === 1
    pointers.current.delete(event.pointerId)
    if (isTap && interactive) pick(event.clientX, event.clientY)
    // Si queda un dedo apoyado, sigue como arrastre desde la vista actual (sin marcar).
    gesture.current =
      pointers.current.size > 0 ? { startView: viewRef.current, start: new Map(pointers.current), moved: true } : null
  }

  function handlePointerCancel(event: PointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId)
    gesture.current = null
  }

  const pendingXY = pending && toMapPoint(pending, projection)
  const targetXY = reveal && toMapPoint(reveal.target, projection)
  const selectedXY = reveal?.selected ? toMapPoint(reveal.selected, projection) : null
  const visibleLabels = map.labels.filter((label) => zoom >= LABEL_MIN_ZOOM[label.level ?? 1])

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-[var(--radius-panel)] border-[6px] border-white shadow-[var(--shadow-elev-2)]"
      style={{ background: COLORS.land }}
    >
      <svg
        ref={svgRef}
        viewBox={`${current.x} ${current.y} ${current.w} ${current.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={`absolute inset-0 h-full w-full touch-none select-none ${interactive ? 'cursor-crosshair' : 'cursor-grab'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        role="img"
        aria-label="Mapa de Godoy Cruz"
      >
        <rect x={extent.minX} y={extent.minY} width={extent.maxX - extent.minX} height={extent.maxY - extent.minY} fill={COLORS.land} />
        <path d={layers.parks} fill={COLORS.park} />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={layers.canals} stroke={COLORS.canal} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
          <path d={layers.rail} stroke={COLORS.rail} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          {/* Las calles se ensanchan un poco al acercar para que se lean mejor. */}
          <path d={layers.minor} stroke={COLORS.minor} strokeWidth={Math.min(1.6 * Math.sqrt(zoom), 6)} vectorEffect="non-scaling-stroke" />
          <path d={layers.medium} stroke={COLORS.casing} strokeWidth={Math.min(5 * Math.sqrt(zoom), 12)} vectorEffect="non-scaling-stroke" />
          <path d={layers.major} stroke={COLORS.casing} strokeWidth={Math.min(7.5 * Math.sqrt(zoom), 16)} vectorEffect="non-scaling-stroke" />
          <path d={layers.medium} stroke={COLORS.medium} strokeWidth={Math.min(3 * Math.sqrt(zoom), 9)} vectorEffect="non-scaling-stroke" />
          <path d={layers.major} stroke={COLORS.major} strokeWidth={Math.min(5 * Math.sqrt(zoom), 12)} vectorEffect="non-scaling-stroke" />
        </g>
        <g
          fontFamily="var(--font-sans)"
          fontWeight="700"
          fill={COLORS.label}
          stroke="#ffffff"
          strokeWidth={px(4)}
          paintOrder="stroke"
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {visibleLabels.map((label) => (
            <text
              key={label.name}
              fontSize={px(LABEL_FONT_PX[label.level ?? 1])}
              transform={`translate(${label.x} ${label.y}) rotate(${label.angle})`}
            >
              {label.name}
            </text>
          ))}
        </g>

        {reveal && targetXY && (
          <g pointerEvents="none">
            {/* Zona válida: círculo de la tolerancia, en metros reales. */}
            <circle
              cx={targetXY.x}
              cy={targetXY.y}
              r={MAP_TOLERANCE_METERS}
              fill={COLORS.correct}
              fillOpacity={0.18}
              stroke={COLORS.correct}
              strokeWidth={3}
              strokeDasharray="10 6"
              vectorEffect="non-scaling-stroke"
            />
            {selectedXY && (
              <line
                x1={selectedXY.x}
                y1={selectedXY.y}
                x2={targetXY.x}
                y2={targetXY.y}
                stroke="#120e2b"
                strokeWidth={3}
                strokeDasharray="8 6"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {selectedXY && <Marker x={selectedXY.x} y={selectedXY.y} radius={px(13)} color={markerColor} border={px(4)} />}
            <Marker x={targetXY.x} y={targetXY.y} radius={px(17)} color={COLORS.correct} border={px(5)} />
            <text
              x={targetXY.x}
              y={targetXY.y - px(30)}
              textAnchor="middle"
              fontFamily="var(--font-sans)"
              fontWeight="900"
              fontSize={px(22)}
              fill="#120e2b"
              stroke="#ffffff"
              strokeWidth={px(6)}
              paintOrder="stroke"
            >
              {reveal.target.name}
            </text>
          </g>
        )}
        {!reveal && pendingXY && (
          <g pointerEvents="none">
            <Marker x={pendingXY.x} y={pendingXY.y} radius={px(15)} color={markerColor} border={px(5)} />
            <circle cx={pendingXY.x} cy={pendingXY.y} r={px(3)} fill="#120e2b" />
          </g>
        )}
      </svg>

      <div className="text-ink pointer-events-none absolute top-4 left-4 grid h-14 w-14 place-items-center rounded-full border border-line bg-white text-xl font-extrabold shadow-[var(--shadow-elev-2)]">
        N↑
      </div>
      {/* Controles grandes para usar con mouse frente al TV. */}
      <div className="absolute top-4 right-4 flex flex-col gap-3">
        <MapButton label="Acercar" onClick={() => zoomFromCenter(BUTTON_ZOOM_STEP)} disabled={zoom >= MAX_ZOOM - 0.01} icon="plus" />
        <MapButton label="Alejar" onClick={() => zoomFromCenter(1 / BUTTON_ZOOM_STEP)} disabled={zoom <= 1.01} icon="minus" />
        <MapButton label="Ver todo el mapa" onClick={() => setView(null)} disabled={view === null} icon="expand" />
      </div>
      <p className="text-ink-2 pointer-events-none absolute right-4 bottom-3 rounded-lg bg-white/90 px-3 py-1 text-base font-semibold shadow-[var(--shadow-elev-1)]">
        {map.attribution}
      </p>
    </div>
  )
}

type MapButtonProps = { label: string; onClick: () => void; disabled: boolean; icon: IconName }

function MapButton({ label, onClick, disabled, icon }: MapButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="text-ink border-line grid h-16 w-16 place-items-center rounded-[var(--radius-control)] border bg-white shadow-[0_4px_0_var(--color-line-strong),var(--shadow-elev-2)] transition-[transform,box-shadow] duration-150 hover:text-accent active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-line-strong)] disabled:text-muted disabled:bg-surface-2 disabled:translate-y-[3px] disabled:shadow-[var(--shadow-elev-1)]"
    >
      <Icon name={icon} className="h-8 w-8" strokeWidth={2.5} />
    </button>
  )
}

function Marker({ x, y, radius, color, border }: { x: number; y: number; radius: number; color: string; border: number }) {
  return <circle cx={x} cy={y} r={radius} fill={color} stroke="#ffffff" strokeWidth={border} />
}
