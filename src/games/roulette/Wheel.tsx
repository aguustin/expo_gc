import { brand } from '../../brand.ts'

// Paleta sobria de segmentos: magenta institucional, blanco, ciruela y rosado claro.
// Cada segmento lleva el color de texto que le da contraste suficiente.
const SEGMENTS = [
  { fill: '#ad0a5d', text: '#ffffff' },
  { fill: '#ffffff', text: '#5e0532' },
  { fill: '#6b0a3c', text: '#ffffff' },
  { fill: '#f6e1ec', text: '#5e0532' },
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

function segmentStyle(index: number, count: number) {
  // Evita que el último segmento quede pegado a uno del mismo color.
  if (count > 1 && index === count - 1 && index % SEGMENTS.length === 0) return SEGMENTS[1]
  return SEGMENTS[index % SEGMENTS.length]
}

// Ruleta en SVG; los ángulos se miden en sentido horario desde el puntero (arriba).
// Solo el grupo de segmentos gira: aro, sombreado, centro y puntero quedan fijos, así la luz
// no rota con la rueda y no se recalculan efectos costosos durante el giro.
export function Wheel({ labels, rotation, spinning, durationMs }: WheelProps) {
  const count = labels.length
  const slice = 360 / Math.max(count, 1)
  const radius = 90

  return (
    <div className="relative aspect-square h-full [perspective:1200px]">
      {/* Sombra de apoyo: elipse estática bajo la rueda. */}
      <div
        className="absolute inset-x-[8%] -bottom-[5%] h-[14%] rounded-[50%]"
        style={{ background: 'radial-gradient(closest-side, rgb(22 26 36 / 0.28), transparent)' }}
        aria-hidden="true"
      />
      <div className="relative h-full w-full [transform:rotateX(8deg)]">
        <svg viewBox="-100 -100 200 200" className="h-full w-full">
          <defs>
            <linearGradient id="wheel-rim" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.5" stopColor="#d5dae4" />
              <stop offset="1" stopColor="#9aa3b5" />
            </linearGradient>
            <radialGradient id="wheel-shade" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0.55" stopColor="#000000" stopOpacity="0" />
              <stop offset="1" stopColor="#000000" stopOpacity="0.22" />
            </radialGradient>
            <linearGradient id="wheel-light" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
              <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="wheel-hub" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#e3e7ee" />
            </radialGradient>
            <clipPath id="wheel-hub-clip">
              <circle r="20" />
            </clipPath>
          </defs>

          {/* Aro exterior con volumen. */}
          <circle r="98" fill="url(#wheel-rim)" />
          <circle r="92.5" fill="#5e0532" />

          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.12, 0.7, 0.12, 1)` : 'none',
            }}
          >
            {count === 1 ? (
              <circle r={radius} fill={SEGMENTS[0].fill} />
            ) : (
              labels.map((_, index) => {
                const start = index * slice
                const end = start + slice
                return (
                  <path
                    key={index}
                    d={`M 0 0 L ${point(start, radius)} A ${radius} ${radius} 0 ${slice > 180 ? 1 : 0} 1 ${point(end, radius)} Z`}
                    fill={segmentStyle(index, count).fill}
                    stroke="#5e0532"
                    strokeOpacity="0.35"
                    strokeWidth="0.8"
                  />
                )
              })
            )}
            {labels.map((label, index) => (
              <text
                key={label}
                transform={`rotate(${(index + 0.5) * slice}) translate(0 -66)`}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={segmentStyle(index, count).text}
                fontSize={count > 12 ? 13 : 16}
                fontWeight="800"
                fontFamily="var(--font-display)"
              >
                {label}
              </text>
            ))}
          </g>

          {/* Sombreado fijo: borde más oscuro y luz desde arriba a la izquierda. */}
          <circle r={radius} fill="url(#wheel-shade)" pointerEvents="none" />
          <circle r={radius} fill="url(#wheel-light)" pointerEvents="none" />

          {/* Centro con el símbolo de Godoy Cruz (sobre blanco, como el original). */}
          <circle r="27" fill="#5e0532" opacity="0.25" transform="translate(0 2)" />
          <circle r="25" fill="url(#wheel-hub)" stroke="#d5dae4" strokeWidth="1.2" />
          <image
            href={brand.symbol}
            x="-22.9"
            y="-27.4"
            width="45.75"
            height="54.75"
            clipPath="url(#wheel-hub-clip)"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>

      {/* Puntero fijo arriba: indica la pregunta sorteada. */}
      <svg viewBox="0 0 40 44" className="absolute top-[-5%] left-1/2 w-[12%] -translate-x-1/2" aria-hidden="true">
        <defs>
          <linearGradient id="wheel-pointer" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c4146f" />
            <stop offset="0.5" stopColor="#ad0a5d" />
            <stop offset="1" stopColor="#5e0532" />
          </linearGradient>
        </defs>
        <path d="M6 7 H34 L20 40 Z" fill="#161a24" opacity="0.18" transform="translate(0 3)" />
        <path d="M5 4 H35 L20 38 Z" fill="url(#wheel-pointer)" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
