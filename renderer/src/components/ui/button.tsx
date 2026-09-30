import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = cva('ui-button relative inline-flex h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-medium disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'ui-button--default', secondary: 'ui-button--secondary', ghost: 'ui-button--ghost', danger: 'ui-button--danger' }, size: { default: 'h-11 px-4', sm: 'h-11 px-3 text-xs', icon: 'h-11 w-11 px-0' } },
  defaultVariants: { variant: 'default', size: 'default' },
})
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants> &
  ({ asChild: true; busy?: never } | { asChild?: false; busy?: boolean })
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, busy = false, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(variants({ variant, size }), className)} {...props} disabled={disabled || busy} aria-busy={busy || props['aria-busy']} data-busy={busy || undefined} />
})
Button.displayName = 'Button'
