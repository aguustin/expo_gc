import type { ReactNode } from 'react'
import { brand } from '../brand.ts'

type AppShellProps = {
  aside?: ReactNode
  children: ReactNode
  // Pantallas de juego: alto fijo de pantalla, así el contenido se adapta y nunca la estira.
  fitScreen?: boolean
}

// Marco común de todas las pantallas: identidad institucional arriba a la izquierda,
// acciones de navegación arriba a la derecha y el contenido debajo.
export function AppShell({ aside, children, fitScreen = false }: AppShellProps) {
  return (
    <div className={`flex flex-col px-[3.5vw] py-[2.2vh] ${fitScreen ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <BrandSymbol className="h-16 w-16" />
          <div className="leading-tight">
            <p className="font-display text-ink text-2xl font-extrabold tracking-tight">{brand.name}</p>
            <p className="text-muted text-base font-semibold">{brand.tagline}</p>
          </div>
        </div>
        {aside}
      </header>
      <main className="flex min-h-0 flex-1 flex-col pt-[2vh]">{children}</main>
    </div>
  )
}

// Símbolo de Godoy Cruz sobre una placa blanca elevada (el JPEG original tiene fondo blanco).
export function BrandSymbol({ className = '' }: { className?: string }) {
  return (
    <span className={`surface-raised grid shrink-0 place-items-center overflow-hidden rounded-2xl p-1.5 ${className} h-22`}>
      <img src={brand.symbol} alt={`Símbolo de ${brand.name}`} className="max-h-full max-w-full object-contain mix-blend-multiply" draggable={false} />
    </span>
  )
}
