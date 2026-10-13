import * as React from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  loadingLabel?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', loading = false, loadingLabel = 'Working...', children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'pressable inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        variant === 'primary' && 'action-gradient',
        variant === 'secondary' && 'bg-gradient-to-br from-secondary to-secondary/70 text-secondary-foreground shadow-sm hover:shadow-soft',
        variant === 'outline' && 'border bg-background text-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-cyan-500/5 hover:border-primary/40',
        variant === 'ghost' && 'text-muted-foreground hover:bg-gradient-to-r hover:from-primary/5 hover:to-cyan-500/5 hover:text-foreground',
        variant === 'danger' && 'action-gradient-danger',
        variant === 'link' && 'text-primary underline-offset-4 hover:underline',
        size === 'sm' && 'h-9 px-3 text-xs',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-5 text-sm',
        size === 'icon' && 'h-10 w-10',
        className,
      )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /><span>{loadingLabel}</span></> : children}
      </button>
  ),
)
Button.displayName = 'Button'
