const SEGMENT_COLORS = [
  'var(--color-accent)',
  'var(--color-accent-2)',
  'var(--color-accent-3)',
  'var(--color-accent-4)',
]

type WheelProps = {
  labels: string[]
  rotation: number
  spinning: boolean
  durationMs: number
}

function point(angle: number, radius: number) {
  const rad = (angle * Math.PI) / 180
  return `${(radius * Math.sin(rad)).toFixed(3)} ${(-radius * Math.cos(rad)).toFixed(3)}`
}

function segmentColor(index: number, count: number) {
  // Evita que el último segmento quede pegado a uno del mismo color.
  if (count > 1 && index === count - 1 && index % SEGMENT_COLORS.length === 0) return SEGMENT_COLORS[1]
  return SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

// Ruleta en SVG; los ángulos se miden en sentido horario desde el puntero (arriba).
export function Wheel({ labels, rotation, spinning, durationMs }: WheelProps) {
  const count = labels.length
  const slice = 360 / Math.max(count, 1)
  const radius = 96

  return (
    <div className="relative aspect-square h-full">
      <svg viewBox="-100 -100 200 200" className="h-full w-full drop-shadow-[0_1rem_1.5rem_rgb(0_0_0/0.45)]">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.12, 0.7, 0.12, 1)` : 'none',
          }}
        >
          {count === 1 ? (
            <circle r={radius} fill={SEGMENT_COLORS[0]} />
          ) : (
            labels.map((_, index) => {
              const start = index * slice
              const end = start + slice
              return (
                <path
                  key={index}
                  d={`M 0 0 L ${point(start, radius)} A ${radius} ${radius} 0 ${slice > 180 ? 1 : 0} 1 ${point(end, radius)} Z`}
                  fill={segmentColor(index, count)}
                  stroke="var(--color-night)"
                  strokeWidth="1.5"
                />
              )
            })
          )}
          {labels.map((label, index) => (
            <text
              key={label}
              transform={`rotate(${(index + 0.5) * slice}) translate(0 -70)`}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--color-night)"
              fontSize={count > 12 ? 13 : 16}
              fontWeight="900"
              fontFamily="var(--font-display)"
            >
              {label}
            </text>
          ))}
        </g>
        <circle r={radius} fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="4" />
        <circle r="22" fill="var(--color-night)" stroke="white" strokeWidth="4" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="20" aria-hidden="true">
          ❓
        </text>
      </svg>
      {/* Puntero fijo arriba: indica la pregunta sorteada. */}
      <svg viewBox="0 0 40 40" className="absolute top-[-4%] left-1/2 w-[12%] -translate-x-1/2" aria-hidden="true">
        <path d="M4 4 H36 L20 36 Z" fill="white" stroke="var(--color-night)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
