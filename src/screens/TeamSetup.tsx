import { useState, type FormEvent } from 'react'
import { AppShell } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { teamColor } from '../components/teamColor.ts'
import { getGame } from '../games/catalog.ts'
import { useSession } from '../state/SessionContext.tsx'
import {
  createSessionId,
  isValid,
  MAX_TEAM_NAME_LENGTH,
  MAX_TEAMS,
  MIN_TEAMS,
  validateTeamNames,
} from '../state/session.ts'

const COUNT_OPTIONS = Array.from({ length: MAX_TEAMS - MIN_TEAMS + 1 }, (_, i) => MIN_TEAMS + i)

export function TeamSetup() {
  const { state, dispatch } = useSession()
  const [count, setCount] = useState(MIN_TEAMS)
  // Se guardan siempre MAX_TEAMS borradores, pero solo los primeros `count` se validan y se envían.
  // Así, bajar la cantidad nunca deja equipos "fantasma" y volver a subirla recupera lo escrito.
  const [drafts, setDrafts] = useState<string[]>(() => Array(MAX_TEAMS).fill(''))
  const [showErrors, setShowErrors] = useState(false)

  const names = drafts.slice(0, count)
  const errors = validateTeamNames(names)
  const modeTitle = state.mode?.kind === 'single' ? getGame(state.mode.game).title : 'Desafío completo'

  function updateName(index: number, value: string) {
    setDrafts((current) => current.map((name, i) => (i === index ? value : name)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValid(errors)) {
      setShowErrors(true)
      return
    }
    dispatch({ type: 'startSession', names, sessionId: createSessionId() })
  }

  return (
    <AppShell
      aside={
        <Button variant="secondary" onClick={() => dispatch({ type: 'backToMenu' })}>
          ← Menú
        </Button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="grid flex-1 grid-cols-[3fr_2fr] gap-[3vw]">
        <div>
          <p className="text-accent-2 text-xl font-bold uppercase">{modeTitle}</p>
          <h1 className="font-display mt-1 text-5xl uppercase">Armá los equipos</h1>

          <fieldset className="mt-6">
            <legend className="text-muted text-xl font-semibold">¿Cuántos equipos juegan?</legend>
            <div className="mt-3 flex gap-4">
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCount(option)}
                  aria-pressed={option === count}
                  className={`font-display h-16 w-24 rounded-2xl text-4xl transition ${
                    option === count ? 'bg-accent-2 text-night scale-105' : 'bg-surface text-ink hover:bg-surface-strong'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {showErrors && errors.count && <p className="text-accent mt-2 text-lg font-bold">{errors.count}</p>}
          </fieldset>

          <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-4">
            {names.map((name, index) => {
              const error = showErrors ? errors.names[index] : null
              return (
                <label key={index} className="block">
                  <span className="text-lg font-bold" style={{ color: teamColor(index) }}>
                    Equipo {index + 1}
                  </span>
                  <input
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                    maxLength={MAX_TEAM_NAME_LENGTH}
                    placeholder={`Nombre del equipo ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    className={`bg-surface placeholder:text-muted/50 mt-1 w-full rounded-2xl border-4 px-5 py-3 text-2xl font-bold outline-none ${
                      error ? 'border-accent' : 'border-transparent focus:border-white/40'
                    }`}
                  />
                  {error && <span className="text-accent mt-1 block text-lg font-bold">{error}</span>}
                </label>
              )
            })}
          </div>
        </div>

        <aside className="bg-surface/70 flex flex-col rounded-[2rem] p-8">
          <h2 className="text-muted text-xl font-bold uppercase">Así quedan</h2>
          <ul className="mt-6 grid flex-1 content-start gap-4">
            {names.map((name, index) => (
              <li
                key={index}
                className="flex items-center gap-4 rounded-2xl px-5 py-4"
                style={{ backgroundColor: `color-mix(in srgb, ${teamColor(index)} 18%, transparent)` }}
              >
                <span
                  className="font-display text-night grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl"
                  style={{ backgroundColor: teamColor(index) }}
                >
                  {index + 1}
                </span>
                <span className={`truncate text-2xl font-extrabold ${name.trim() ? '' : 'text-muted/60 italic'}`}>
                  {name.trim() || 'Sin nombre'}
                </span>
              </li>
            ))}
          </ul>
          <Button type="submit" className="mt-6 w-full py-5 text-3xl">
            ¡Comenzar!
          </Button>
        </aside>
      </form>
    </AppShell>
  )
}
