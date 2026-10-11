import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center', className)}>
      <div className="mb-3 rounded-full bg-secondary p-3 text-muted-foreground"><Inbox className="h-5 w-5" /></div>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
