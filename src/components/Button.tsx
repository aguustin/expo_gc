import type { ComponentPropsWithRef } from 'react'

type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: 'primary' | 'secondary'
}

const VARIANTS = {
  primary: 'bg-accent text-white shadow-[0_0.4rem_0_rgb(0_0_0/0.35)] hover:brightness-110',
  secondary: 'bg-surface-strong text-ink ring-2 ring-white/15 hover:bg-white/15',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-2xl px-8 py-4 text-xl font-extrabold transition active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
