// Piezas visuales compartidas por los juegos (solo presentación: no contienen reglas).
import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon.tsx'

// --- Temporizador: barra hundida + número grande; color e ícono cambian al acercarse el final. ---
export function TimerBar({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const tone =
    secondsLeft <= 5 ? 'var(--color-danger)' : secondsLeft <= 10 ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <div className="flex flex-1 items-center gap-5">
      <div className="surface-sunken h-5 flex-1 overflow-hidden rounded-full">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${(secondsLeft / totalSeconds) * 100}%`,
            backgroundColor: tone,
            boxShadow: 'inset 0 -3px 0 rgb(0 0 0 / 0.18), inset 0 2px 0 rgb(255 255 255 / 0.35)',
          }}
        />
      </div>
      <p
        className="font-display flex w-36 items-center justify-end gap-2 text-5xl font-extrabold tabular-nums"
        style={{ color: tone }}
        aria-label={`${secondsLeft} segundos restantes`}
      >
        <Icon name="clock" className="h-9 w-9" strokeWidth={2.5} />
        {secondsLeft}s
      </p>
    </div>
  )
}

// --- Mensaje de estado (resultado de una jugada). Siempre lleva ícono + texto. ---
export type StatusTone = 'success' | 'danger' | 'warning' | 'neutral'

const TONES: Record<StatusTone, { className: string; icon: IconName | null }> = {
  success: { className: 'bg-success text-white', icon: 'check' },
  danger: { className: 'bg-danger text-white', icon: 'x' },
  warning: { className: 'bg-warning text-white', icon: 'clock' },
  neutral: { className: 'surface-raised text-ink', icon: null },
}

export function StatusBanner({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const { className, icon } = TONES[tone]
  return (
    <p
      className={`flex h-14 w-full min-w-0 items-center justify-center gap-3 rounded-[var(--radius-control)] px-6 text-2xl font-extrabold shadow-[var(--shadow-elev-2)] ${className}`}
      role="status"
    >
      {icon && <Icon name={icon} className="h-8 w-8" strokeWidth={3} />}
      <span className="truncate">{children}</span>
    </p>
  )
}

// --- Opción de respuesta: tarjeta elevada con letra; estados claros también por ícono. ---
export type AnswerState = 'idle' | 'correct' | 'wrong' | 'dimmed'

const ANSWER_STYLES: Record<AnswerState, string> = {
  idle:
    'bg-white border-line text-ink shadow-[0_4px_0_var(--color-line-strong),var(--shadow-elev-1)] ' +
    'enabled:hover:-translate-y-0.5 enabled:hover:border-accent-line enabled:active:translate-y-[3px] enabled:active:shadow-[0_1px_0_var(--color-line-strong)]',
  correct: 'bg-success-soft border-success text-ink shadow-[0_4px_0_var(--color-success),var(--shadow-elev-2)]',
  wrong: 'bg-danger-soft border-danger text-ink shadow-[0_4px_0_var(--color-danger),var(--shadow-elev-2)]',
  dimmed: 'bg-surface-2 border-transparent text-muted opacity-60',
}

type AnswerOptionProps = {
  letter: string
  state: AnswerState
  disabled: boolean
  onClick: () => void
  textClassName?: string
  children: ReactNode
}

export function AnswerOption({ letter, state, disabled, onClick, textClassName = 'text-3xl', children }: AnswerOptionProps) {
  const badge =
    state === 'correct'
      ? 'bg-success text-white'
      : state === 'wrong'
        ? 'bg-danger text-white'
        : state === 'dimmed'
          ? 'bg-surface-3 text-muted'
          : 'bg-accent-soft text-accent'
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[var(--radius-control)] border-2 px-5 py-2.5 text-left font-bold transition-[transform,box-shadow,background-color,border-color] duration-150 disabled:cursor-default ${textClassName} ${ANSWER_STYLES[state]}`}
    >
      <span className={`font-display grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl font-extrabold ${badge}`}>
        {state === 'correct' ? <Icon name="check" className="h-7 w-7" strokeWidth={3} /> : state === 'wrong' ? <Icon name="x" className="h-7 w-7" strokeWidth={3} /> : letter}
      </span>
      <span className="min-w-0 flex-1 leading-tight">{children}</span>
    </button>
  )
}

// --- Encabezado de panel: etiqueta pequeña en mayúsculas + contenido. ---
export function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="text-accent text-xl font-extrabold tracking-wide uppercase">{children}</p>
}

// --- Píldora informativa (progreso de la ronda, etc.). ---
export function InfoPill({ children }: { children: ReactNode }) {
  return (
    <p className="surface-raised text-ink shrink-0 rounded-full px-5 py-2 text-2xl font-extrabold tabular-nums">{children}</p>
  )
}
