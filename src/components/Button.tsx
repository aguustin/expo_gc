import type { ComponentPropsWithRef } from 'react'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'md' | 'lg' | 'xl'
}

// Botón con volumen: una "cara inferior" (sombra sólida) que se hunde al presionar.
const VARIANTS = {
  primary:
    'bg-accent text-white shadow-[0_5px_0_var(--color-accent-deep),var(--shadow-elev-2)] hover:bg-accent-strong ' +
    'active:translate-y-[4px] active:shadow-[0_1px_0_var(--color-accent-deep),var(--shadow-elev-1)]',
  secondary:
    'bg-surface text-ink border border-line shadow-[0_5px_0_var(--color-line-strong),var(--shadow-elev-1)] hover:bg-surface-2 ' +
    'active:translate-y-[4px] active:shadow-[0_1px_0_var(--color-line-strong)]',
  quiet: 'bg-transparent text-ink-2 hover:bg-surface-3 active:bg-line',
}

const SIZES = {
  md: 'min-h-14 px-6 py-3 text-xl gap-3',
  lg: 'min-h-16 px-8 py-4 text-2xl gap-3',
  xl: 'min-h-20 px-10 py-5 text-3xl gap-4',
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[var(--radius-control)] font-bold tracking-tight transition-[transform,box-shadow,background-color] duration-150 ease-out disabled:cursor-not-allowed disabled:translate-y-[4px] disabled:opacity-45 disabled:shadow-none ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  )
}
