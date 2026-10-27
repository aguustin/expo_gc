import { brand } from '../brand.ts'
import { Button } from '../components/Button.tsx'
import { GAME_ICONS } from '../components/gameIcons.ts'
import { Icon } from '../components/Icon.tsx'
import { GAMES } from '../games/catalog.ts'

// Pantalla de bienvenida (estado visual de App, no de la sesión): identidad institucional
// y una única acción para entrar al menú de juegos.
export function Welcome({ onStart, onRaffle }: { onStart: () => void; onRaffle: () => void }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden px-[5vw] py-[4vh]">
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-[4vw]">
        <section className="rise-in">
          <span className="surface-raised grid h-32 w-32 place-items-center overflow-hidden rounded-[1.75rem] p-3">
            <img
              src={brand.symbol}
              alt={`Símbolo de ${brand.name}`}
              className="max-h-full max-w-full object-contain mix-blend-multiply"
              draggable={false}
            />
          </span>
          <p className="text-accent mt-8 text-2xl font-extrabold tracking-wide uppercase">{brand.name} · Exposición interactiva</p>
          <h1 className="font-display text-ink mt-3 text-7xl leading-[1.02] font-extrabold tracking-tight">
            ¿Cuánto sabés de <span className="text-accent">Godoy Cruz</span>?
          </h1>
          <p className="text-ink-2 mt-5 max-w-[36rem] text-3xl leading-snug font-medium">
            Tres juegos para descubrir el departamento. Jugá en equipos de 2 a 4 y sumá puntos.
          </p>
          <Button size="xl" className="mt-9" onClick={onStart} autoFocus>
            Empezar
            <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
          </Button>
        </section>

        {/* Tarjetas de los juegos en escalera con perspectiva: decorativas y estáticas (sin animación continua). */}
        <section className="grid gap-5 pr-[3vw] [perspective:1600px]" aria-hidden="true">
          {GAMES.map((game, index) => (
            // Capa externa: inclinación fija. Capa interna: animación de entrada (ambas usan transform).
            <div key={game.id} style={{ transform: `rotateY(-12deg) translateX(${index * 1.1}rem)` }}>
              <div
                className="surface-raised rise-in flex items-center gap-6 rounded-[var(--radius-panel)] p-6"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="bg-accent-soft text-accent grid h-20 w-20 shrink-0 place-items-center rounded-2xl shadow-[inset_0_-3px_0_var(--color-accent-line)]">
                  <Icon name={GAME_ICONS[game.id]} className="h-11 w-11" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-ink text-3xl font-extrabold tracking-tight">{game.title}</p>
                  <p className="text-ink-2 mt-1 text-xl leading-snug font-medium">{game.description}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="mt-4 flex items-center justify-end gap-5">
        {/* Acceso discreto al sorteo (pide contraseña). */}
        <button
          type="button"
          onClick={onRaffle}
          className="mt-9 text-muted/70 hover:text-ink-2 mr-auto flex items-center gap-2 rounded-lg px-2 py-1 text-base font-semibold transition-colors"
        >
          <Icon name="lock" className=" h-4 w-4" />
          Sorteo
        </button>
        <p className="text-muted text-xl font-bold tracking-wide uppercase">Sede</p>
        <span className="surface-raised inline-flex h-20 items-center overflow-hidden rounded-2xl px-5 py-2">
          <img
            src={brand.venueLogo}
            alt={`Sede: ${brand.venueName}`}
            className="h-full w-auto object-contain mix-blend-multiply"
            draggable={false}
          />
        </span>
      </footer>
    </div>
  )
}
