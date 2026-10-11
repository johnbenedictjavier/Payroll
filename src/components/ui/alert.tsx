import { cn } from '@/lib/utils'

export function Alert({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'danger' | 'warning' }) {
  return <div role={variant === 'danger' || variant === 'warning' ? 'alert' : undefined} className={cn('rounded-xl border p-4 text-sm', variant === 'default' && 'bg-secondary/50', variant === 'danger' && 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200', variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200', className)} {...props} />
}
