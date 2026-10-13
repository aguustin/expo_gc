import { AppShell } from '../components/AppShell.tsx'
import { CHALLENGE_AVAILABLE, GAMES } from '../games/catalog.ts'
import { useSession } from '../state/SessionContext.tsx'

const CARD_ACCENTS = ['var(--color-accent)', 'var(--color-accent-2)', 'var(--color-accent-4)']

export function MainMenu() {
  const { dispatch } = useSession()
  const challengeAvailable = CHALLENGE_AVAILABLE && GAMES.every((game) => game.available)

  return (
    <AppShell>
      <section className="mb-[4vh] text-center">
        <h1 className="font-display text-6xl leading-none tracking-tight uppercase">
          ¿Cuánto sabés de <span className="text-accent-2">Godoy Cruz</span>?
        </h1>
        <p className="text-muted mt-4 text-2xl font-semibold">Elegí un juego y armá de 2 a 4 equipos.</p>
      </section>

      <section className="grid flex-1 grid-cols-3 gap-[2vw]">
        {GAMES.map((game, index) => (
          <button
            key={game.id}
            type="button"
            onClick={() => dispatch({ type: 'selectMode', mode: { kind: 'single', game: game.id } })}
            className="bg-surface group relative flex flex-col items-start overflow-hidden rounded-[2rem] p-8 text-left transition hover:-translate-y-1"
            style={{ boxShadow: `inset 0 0.6rem 0 ${CARD_ACCENTS[index]}` }}
          >
            {!game.available && (
              <span className="bg-night/70 text-muted absolute top-6 right-6 rounded-full px-4 py-1 text-sm font-bold uppercase">
                En desarrollo
              </span>
            )}
            <span className="mt-2 text-6xl" aria-hidden="true">
              {game.icon}
            </span>
            <h2 className="font-display mt-6 text-3xl leading-tight" style={{ color: CARD_ACCENTS[index] }}>
              {game.title}
            </h2>
            <p className="text-muted mt-3 text-xl">{game.description}</p>
          </button>
        ))}
      </section>

      <section className="mt-[3vh] flex justify-center">
        <button
          type="button"
          disabled={!challengeAvailable}
          onClick={() => dispatch({ type: 'selectMode', mode: { kind: 'challenge' } })}
          className="from-accent via-accent-2 to-accent-3 text-night rounded-full bg-linear-to-r px-12 py-5 text-3xl font-black uppercase shadow-[0_0.5rem_0_rgb(0_0_0/0.35)] transition enabled:hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35 disabled:grayscale-[0.6]"
        >
          🏆 Desafío completo
        </button>
      </section>
      {!challengeAvailable && (
        <p className="text-muted mt-3 text-center text-lg">
          El desafío completo (los tres juegos seguidos) estará disponible próximamente.
        </p>
      )}
    </AppShell>
  )
}
