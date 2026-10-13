import type { ReactNode } from 'react'
import { brand } from '../brand.ts'

type AppShellProps = {
  aside?: ReactNode
  children: ReactNode
}

export function AppShell({ aside, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col px-[4vw] py-[2.5vh]">
      <header className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <img
            src={brand.logo}
            alt={brand.logoIsPlaceholder ? 'Espacio para el escudo de Godoy Cruz' : `Escudo de ${brand.name}`}
            className="h-16 w-auto"
          />
          <div className="leading-tight">
            <p className="font-display text-2xl tracking-tight uppercase">{brand.name}</p>
            <p className="text-muted text-base font-semibold">{brand.tagline}</p>
          </div>
        </div>
        {aside}
      </header>
      <main className="flex flex-1 flex-col py-[2.5vh]">{children}</main>
    </div>
  )
}
