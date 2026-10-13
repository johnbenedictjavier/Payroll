import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { NexMascot } from '@/components/brand/nex-mascot'

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
  return <Dialog open={open} onClose={() => { if (!loading) onClose() }} title={title} description={description} className="sm:max-w-lg" sideContent={<NexMascot size="md" decorative className="h-24 w-24 sm:h-32 sm:w-32" />}>
    <div className="space-y-5">
      {children}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={loading} onClick={onClose}>Cancel</Button>
        <Button type="button" variant={variant} loading={loading} loadingLabel="Working..." onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </Dialog>
}
