import { cn } from '@/lib/utils'

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide',
        variant === 'default' && 'bg-accent text-accent-foreground',
        variant === 'success' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        variant === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        variant === 'danger' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
        variant === 'muted' && 'bg-secondary text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
