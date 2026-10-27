import { useEffect, useRef, useState } from 'react'
import expoEduLogo from '../assets/expo-edu-comp.png'
import { BrandSymbol } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { Icon } from '../components/Icon.tsx'
import { drawSchool, fairRandom, loadWinners, remainingSchools, saveWinners, type School } from './raffleLogic.ts'
import { SCHOOLS } from './schools.ts'

// Duración del «tambor» de nombres antes de mostrar el ganador.
const DRAW_DURATION_MS = 3200

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Sorteo de colegios: un botón elige al azar entre los que todavía no ganaron, se muestra el
// cartel de felicitaciones hasta tocar «Continuar» y el ganador queda descartado.
export function RaffleScreen({ onExit }: { onExit: () => void }) {
  const [winners, setWinners] = useState<string[]>(() => loadWinners(SCHOOLS.map((school) => school.code)))
  const [display, setDisplay] = useState<School | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [winner, setWinner] = useState<School | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => saveWinners(winners), [winners])
  // Al salir de la pantalla no queda ningún temporizador corriendo.
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const remaining = remainingSchools(SCHOOLS, winners)

  function draw() {
    if (drawing || winner) return
    const chosen = drawSchool(SCHOOLS, winners, fairRandom())
    if (!chosen) return
    const finish = () => {
      timer.current = null
      setDisplay(chosen)
      setDrawing(false)
      setWinner(chosen)
      // Se descarta en el mismo momento en que gana: una recarga no lo vuelve a poner en juego.
      setWinners((current) => (current.includes(chosen.code) ? current : [...current, chosen.code]))
    }
    if (prefersReducedMotion() || remaining.length === 1) {
      finish()
      return
    }
    // Tambor: nombres al azar cada vez más lentos (curva de frenado) hasta detenerse en el ganador.
    setDrawing(true)
    const start = performance.now()
    const tick = () => {
      const elapsed = performance.now() - start
      if (elapsed >= DRAW_DURATION_MS) {
        finish()
        return
      }
      setDisplay(remaining[Math.floor(Math.random() * remaining.length)])
      const progress = elapsed / DRAW_DURATION_MS
      timer.current = window.setTimeout(tick, 60 + 380 * progress * progress)
    }
    tick()
  }

  function reset() {
    setWinners([])
    setDisplay(null)
    setConfirmReset(false)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden px-[3.5vw] py-[2.2vh]">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <BrandSymbol className="h-20 w-20" />
        <span className="surface-raised inline-flex h-[13vh] items-center overflow-hidden rounded-[var(--radius-panel)] px-6 py-2">
          <img src={expoEduLogo} alt="Expo Edu Innova" className="h-full w-auto object-contain mix-blend-multiply" draggable={false} />
        </span>
        <div className="flex justify-end gap-3">
          <Button variant="quiet" onClick={() => setConfirmReset(true)} disabled={drawing || winners.length === 0}>
            <Icon name="refresh" className="h-6 w-6" />
            Reiniciar
          </Button>
          <Button variant="secondary" onClick={onExit} disabled={drawing}>
            <Icon name="exit" className="h-6 w-6" />
            Salir
          </Button>
        </div>
      </header>

      <main className="mt-[3vh] grid min-h-0 flex-1 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-[2.5vw]">
        {/* Tambor del sorteo */}
        <section className="surface-raised flex min-h-0 flex-col items-center justify-center gap-8 rounded-[var(--radius-panel)] p-10 text-center">
          <p className="text-accent text-3xl font-extrabold tracking-wide uppercase">Sorteo de colegios</p>
          <div
            className="surface-sunken flex min-h-[38%] w-full flex-col items-center justify-center rounded-[var(--radius-panel)] px-8 py-6"
            aria-live="polite"
          >
            {display && (remaining.length > 0 || winner) ? (
              <>
                <p className="text-muted text-2xl font-bold tabular-nums">{display.code}</p>
                <p
                  className={`font-display mt-2 leading-tight font-extrabold tracking-tight ${drawing ? 'text-ink-2' : 'text-ink'} ${
                    display.name.length > 32 ? 'text-4xl' : 'text-5xl'
                  }`}
                >
                  {display.name}
                </p>
              </>
            ) : (
              <p className="text-muted text-3xl font-semibold">
                {remaining.length > 0 ? 'Tocá «Sortear» para elegir un colegio' : 'Ya salieron todos los colegios'}
              </p>
            )}
          </div>
          <Button size="xl" className="min-w-[20rem]" onClick={draw} disabled={drawing || remaining.length === 0}>
            <Icon name="trophy" className="h-10 w-10" />
            {drawing ? 'Sorteando…' : '¡Sortear!'}
          </Button>
          <p className="text-ink-2 text-2xl font-bold">
            Quedan {remaining.length} de {SCHOOLS.length} colegios
          </p>
        </section>

        {/* Participantes: los ganadores quedan marcados y fuera del sorteo. */}
        <section className="surface-raised flex min-h-0 flex-col rounded-[var(--radius-panel)] p-6">
          <h2 className="text-muted text-lg font-extrabold tracking-wide uppercase">Participantes</h2>
          <ul className="mt-3 grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-x-4 gap-y-1.5 overflow-hidden">
            {SCHOOLS.map((school) => {
              const won = winners.includes(school.code)
              return (
                <li
                  key={school.code}
                  className={`flex min-h-0 items-center gap-2 rounded-xl px-3 text-base leading-tight font-semibold ${
                    won ? 'bg-accent-soft text-accent-strong' : 'text-ink-2'
                  }`}
                >
                  {won ? (
                    <Icon name="trophy" className="h-5 w-5" />
                  ) : (
                    <span className="bg-line h-2 w-2 shrink-0 rounded-full" aria-hidden="true" />
                  )}
                  <span className="line-clamp-2 min-w-0">
                    {school.name}
                    {won && <span className="sr-only"> (ya ganó)</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      </main>

      {winner && <WinnerBanner school={winner} onContinue={() => setWinner(null)} />}
      {confirmReset && (
        <ConfirmDialog
          title="¿Reiniciar el sorteo?"
          message="Todos los colegios vuelven a participar, incluidos los que ya ganaron."
          icon="refresh"
          cancelLabel="Cancelar"
          onCancel={() => setConfirmReset(false)}
          confirmLabel="Sí, reiniciar"
          onConfirm={reset}
        />
      )}
    </div>
  )
}

const CONFETTI_COLORS = ['#ad0a5d', '#ffb703', '#1d4ed8', '#06d6a0', '#7e22ce', '#ff6b35']

// Cartel de felicitaciones: queda en pantalla hasta tocar «Continuar» (sin cierre por Escape ni clic afuera).
function WinnerBanner({ school, onContinue }: { school: School; onContinue: () => void }) {
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => button.current?.focus(), [])
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[rgb(22_26_36/0.6)] p-[4vw]">
      {/* Papel picado: una sola caída corta, decorativa. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => (
          <span
            key={i}
            className="confetti-piece absolute top-0 h-4 w-2.5 rounded-sm"
            style={{
              left: `${(i * 37) % 100}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 12) * 90}ms`,
              animationDuration: `${2200 + (i % 7) * 260}ms`,
            }}
          />
        ))}
      </div>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="winner-title"
        className="rise-in relative w-full max-w-5xl rounded-[var(--radius-panel)] bg-white px-12 py-12 text-center shadow-[var(--shadow-elev-3)]"
      >
        <span className="bg-accent mx-auto grid h-24 w-24 place-items-center rounded-full text-white shadow-[0_5px_0_var(--color-accent-deep)]">
          <Icon name="trophy" className="h-14 w-14" />
        </span>
        <h2 id="winner-title" className="font-display text-accent mt-6 text-7xl font-extrabold tracking-tight">
          ¡Felicitaciones!
        </h2>
        <p className="text-ink-2 mt-4 text-3xl font-semibold">El colegio ganador es</p>
        <p className="font-display text-ink mt-3 text-6xl leading-tight font-extrabold tracking-tight">{school.name}</p>
        <p className="text-muted mt-2 text-3xl font-bold tabular-nums">{school.code}</p>
        <Button ref={button} size="xl" className="mt-10" onClick={onContinue}>
          Continuar
          <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  )
}
