import { useState, type FormEvent } from 'react'
import { AppShell } from '../components/AppShell.tsx'
import { Button } from '../components/Button.tsx'
import { GAME_ICONS } from '../components/gameIcons.ts'
import { Icon } from '../components/Icon.tsx'
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
  const single = state.mode?.kind === 'single' ? getGame(state.mode.game) : null
  const modeTitle = single ? single.title : 'Desafío completo'

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
          <Icon name="arrowLeft" className="h-6 w-6" />
          Menú
        </Button>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="rise-in grid flex-1 grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-[3vw]">
        <div>
          <p className="text-accent flex items-center gap-3 text-xl font-extrabold tracking-wide uppercase">
            <Icon name={single ? GAME_ICONS[single.id] : 'trophy'} className="h-7 w-7" />
            {modeTitle}
          </p>
          <h1 className="font-display text-ink mt-2 text-5xl font-extrabold tracking-tight">Armá los equipos</h1>

          <fieldset className="mt-7">
            <legend className="text-ink-2 text-xl font-bold">¿Cuántos equipos juegan?</legend>
            {/* Selector segmentado: la opción elegida queda elevada; las otras, hundidas. */}
            <div className="surface-sunken mt-3 inline-flex gap-2 rounded-[1.4rem] p-2">
              {COUNT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCount(option)}
                  aria-pressed={option === count}
                  className={`font-display h-16 w-24 rounded-[var(--radius-control)] text-4xl font-extrabold transition-[transform,box-shadow,background-color] duration-200 ${
                    option === count
                      ? 'bg-accent -translate-y-0.5 text-white shadow-[0_4px_0_var(--color-accent-deep),var(--shadow-elev-2)]'
                      : 'text-ink-2 hover:bg-white'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            {showErrors && errors.count && (
              <p className="text-danger mt-2 flex items-center gap-2 text-lg font-bold">
                <Icon name="alert" className="h-6 w-6" />
                {errors.count}
              </p>
            )}
          </fieldset>

          <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-4">
            {names.map((name, index) => {
              const error = showErrors ? errors.names[index] : null
              return (
                <label key={index} className="block">
                  <span className="flex items-center gap-2 text-lg font-bold" style={{ color: teamColor(index) }}>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor(index) }} aria-hidden="true" />
                    Equipo {index + 1}
                  </span>
                  <input
                    value={name}
                    onChange={(event) => updateName(index, event.target.value)}
                    maxLength={MAX_TEAM_NAME_LENGTH}
                    placeholder={`Nombre del equipo ${index + 1}`}
                    aria-invalid={error ? true : undefined}
                    className={`text-ink placeholder:text-muted/70 mt-1.5 w-full rounded-[var(--radius-control)] border-2 bg-white px-5 py-3 text-2xl font-bold shadow-[var(--shadow-inset)] transition-[border-color,box-shadow] outline-none focus:shadow-[0_0_0_4px_var(--color-accent-soft)] ${
                      error ? 'border-danger' : 'border-line focus:border-accent'
                    }`}
                  />
                  {error && (
                    <span className="text-danger mt-1 flex items-center gap-2 text-lg font-bold">
                      <Icon name="alert" className="h-5 w-5" />
                      {error}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        <aside className="surface-raised flex flex-col rounded-[var(--radius-panel)] p-8">
          <h2 className="text-muted flex items-center gap-2 text-xl font-extrabold tracking-wide uppercase">
            <Icon name="users" className="h-6 w-6" />
            Así quedan
          </h2>
          <ul className="mt-5 grid flex-1 content-start gap-3">
            {names.map((name, index) => (
              <li key={index} className="bg-surface-2 flex items-center gap-4 rounded-[var(--radius-control)] border border-line px-4 py-3">
                <span
                  className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl font-extrabold text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]"
                  style={{ backgroundColor: teamColor(index) }}
                >
                  {index + 1}
                </span>
                <span className={`truncate text-2xl font-bold ${name.trim() ? 'text-ink' : 'text-muted italic'}`}>
                  {name.trim() || 'Sin nombre'}
                </span>
              </li>
            ))}
          </ul>
          <Button type="submit" size="xl" className="mt-6 w-full">
            Comenzar
            <Icon name="arrowRight" className="h-9 w-9" strokeWidth={2.5} />
          </Button>
        </aside>
      </form>
    </AppShell>
  )
}
