import { brand } from '../brand.ts'
import { AppShell } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { GAME_ICONS } from '../components/gameIcons.ts'
import { Icon } from '../components/Icon.tsx'
import { CHALLENGE_AVAILABLE, GAMES } from '../games/catalog.ts'
import { useSession } from '../state/SessionContext.tsx'

export function MainMenu({ onHome }: { onHome: () => void }) {
  const { dispatch } = useSession()
  const challengeAvailable = CHALLENGE_AVAILABLE && GAMES.every((game) => game.available)

  return (
    <AppShell
      aside={
        <Button variant="secondary" onClick={onHome}>
          <Icon name="home" className="h-6 w-6" />
          Inicio
        </Button>
      }
    >
      <section className="rise-in flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-ink text-5xl font-extrabold tracking-tight">Elegí cómo jugar</h1>
          <p className="text-ink-2 mt-2 text-2xl font-medium">Un juego suelto o los tres seguidos. Se juega en equipos de 2 a 4.</p>
        </div>
        <span className="surface-raised inline-flex h-16 items-center rounded-2xl px-4 py-2">
          <img src={brand.venueLogo} alt={`Sede: ${brand.venueName}`} className="h-full w-auto object-contain mix-blend-multiply" draggable={false} />
        </span>
      </section>

      <p className="text-muted mt-[3vh] text-xl font-extrabold tracking-wide uppercase">Juegos individuales</p>
      <section className="mt-3 grid flex-1 grid-cols-3 gap-[2vw]">
        {GAMES.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => dispatch({ type: 'selectMode', mode: { kind: 'single', game: game.id } })}
            className="surface-raised tilt-card group flex flex-col items-start rounded-[var(--radius-panel)] p-7 text-left"
          >
            <span className="bg-accent-soft text-accent grid h-20 w-20 place-items-center rounded-2xl shadow-[inset_0_-3px_0_var(--color-accent-line)]">
              <Icon name={GAME_ICONS[game.id]} className="h-11 w-11" />
            </span>
            {!game.available && (
              <span className="bg-surface-3 text-muted mt-4 rounded-full px-4 py-1 text-base font-bold uppercase">En desarrollo</span>
            )}
            <h2 className="font-display text-ink mt-5 text-3xl leading-tight font-extrabold">{game.title}</h2>
            <p className="text-ink-2 mt-2 text-xl leading-snug font-medium">{game.description}</p>
            <span className="text-accent mt-auto flex items-center gap-2 pt-5 text-xl font-extrabold">
              Jugar
              <Icon name="arrowRight" className="h-6 w-6 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
            </span>
          </button>
        ))}
      </section>

      {/* El desafío se diferencia de los juegos sueltos: superficie magenta, ancho completo y etapas visibles. */}
      <section className="mt-[3vh]">
        <button
          type="button"
          disabled={!challengeAvailable}
          onClick={() => dispatch({ type: 'selectMode', mode: { kind: 'challenge' } })}
          className="tilt-card group flex w-full items-center gap-8 rounded-[var(--radius-panel)] bg-[linear-gradient(135deg,var(--color-accent)_0%,var(--color-accent-deep)_100%)] px-9 py-6 text-left text-white shadow-[0_6px_0_var(--color-accent-deep),var(--shadow-elev-3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]">
            <Icon name="trophy" className="h-12 w-12" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="font-display block text-4xl font-extrabold tracking-tight">Desafío completo</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xl font-semibold text-white/90">
              {GAMES.map((game, index) => (
                <span key={game.id} className="flex items-center gap-2">
                  {index > 0 && <Icon name="arrowRight" className="h-5 w-5 opacity-70" />}
                  {game.title}
                </span>
              ))}
              <span className="text-white/75">· puntaje acumulado</span>
            </span>
          </span>
          <span className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-2xl font-extrabold text-[var(--color-accent)] shadow-[var(--shadow-elev-2)]">
            Jugar
            <Icon name="arrowRight" className="h-7 w-7 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.5} />
          </span>
        </button>
        {!challengeAvailable && (
          <p className="text-muted mt-3 text-center text-lg">El desafío completo (los tres juegos seguidos) estará disponible próximamente.</p>
        )}
      </section>
    </AppShell>
  )
}
