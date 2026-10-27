import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '../components/Button.tsx'
import { Icon } from '../components/Icon.tsx'
import { RAFFLE_PASSWORD } from './raffleLogic.ts'

type RaffleAccessDialogProps = { onCancel: () => void; onGranted: () => void }

// Pide la contraseña del sorteo. Escape cancela; un error limpia el campo para volver a intentar.
export function RaffleAccessDialog({ onCancel, onGranted }: RaffleAccessDialogProps) {
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    input.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (value === RAFFLE_PASSWORD) {
      onGranted()
      return
    }
    setError(true)
    setValue('')
    input.current?.focus()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(22_26_36/0.55)] p-[4vw]">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="raffle-access-title"
        className="rise-in w-full max-w-xl rounded-[var(--radius-panel)] bg-white p-10 text-center shadow-[var(--shadow-elev-3)]"
      >
        <span className="bg-accent-soft text-accent mx-auto grid h-16 w-16 place-items-center rounded-full">
          <Icon name="lock" className="h-9 w-9" />
        </span>
        <h2 id="raffle-access-title" className="font-display text-ink mt-4 text-3xl font-extrabold tracking-tight">
          Acceso al sorteo
        </h2>
        <label className="mt-6 block text-left">
          <span className="text-ink-2 text-xl font-bold">Contraseña</span>
          <input
            ref={input}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(false)
            }}
            aria-invalid={error || undefined}
            className={`text-ink mt-2 w-full rounded-[var(--radius-control)] border-2 bg-white px-5 py-3 text-center text-3xl font-bold tracking-[0.4em] shadow-[var(--shadow-inset)] outline-none focus:shadow-[0_0_0_4px_var(--color-accent-soft)] ${
              error ? 'border-danger' : 'border-line focus:border-accent'
            }`}
          />
        </label>
        <p className="text-danger mt-2 flex h-7 items-center justify-center gap-2 text-lg font-bold" role="status">
          {error && (
            <>
              <Icon name="alert" className="h-5 w-5" />
              Contraseña incorrecta
            </>
          )}
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={value === ''}>
            Entrar
          </Button>
        </div>
      </form>
    </div>
  )
}
