import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { NexMascot } from '@/components/brand/nex-mascot'
import { cn } from '@/lib/utils'

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  loading = false,
  variant = 'primary',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  variant?: 'primary' | 'danger'
  children?: React.ReactNode
}) {
  const Icon = variant === 'danger' ? AlertTriangle : variant === 'primary' ? ShieldCheck : CheckCircle2
  return <Dialog open={open} onClose={() => { if (!loading) onClose() }} title={title} description={description} className="sm:max-w-lg">
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border bg-secondary/40 p-4">
        <div className={cn('rounded-xl p-3', variant === 'danger' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1 text-sm leading-6 text-muted-foreground">Nex is ready to help you finish this step.</div>
        <NexMascot size="sm" className="-mr-2" />
      </div>
      {children}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Cancel</Button>
        <Button type="button" variant={variant} loading={loading} loadingLabel="Working..." onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </Dialog>
}
