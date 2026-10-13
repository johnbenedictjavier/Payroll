import { cn, titleCase } from '@/lib/utils'

export function Badge({ className, variant = 'default', children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition-colors',
        variant === 'default' && 'bg-accent text-accent-foreground',
        variant === 'success' && 'bg-success/15 text-success dark:bg-success/20',
        variant === 'warning' && 'bg-warning/20 text-amber-800 dark:bg-warning/20 dark:text-amber-200',
        variant === 'danger' && 'bg-destructive/15 text-red-700 dark:bg-destructive/20 dark:text-red-200',
        variant === 'muted' && 'bg-secondary text-muted-foreground',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? titleCase(children) : children}
    </span>
  )
}
