import * as React from 'react'
import { cn } from '@/lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'pms-gradient text-primary-foreground shadow-sm hover:brightness-105',
        variant === 'secondary' && 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        variant === 'outline' && 'border bg-background text-foreground hover:bg-secondary',
        variant === 'ghost' && 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        variant === 'danger' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        variant === 'link' && 'text-primary underline-offset-4 hover:underline',
        size === 'sm' && 'h-9 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-sm',
        size === 'icon' && 'h-10 w-10',
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
