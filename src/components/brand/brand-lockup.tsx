import { cn } from '@/lib/utils'

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

export function BrandLockup({
  compact = false,
  institutions = false,
  inverse = false,
  display = 'default',
  className,
}: {
  compact?: boolean
  institutions?: boolean
  inverse?: boolean
  display?: 'default' | 'login'
  className?: string
}) {
  const loginDisplay = display === 'login'
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img src={publicAsset('pms.png')} alt="PayNexus Payroll Management System" className={cn('shrink-0 object-contain', compact ? 'h-10 w-10' : loginDisplay ? 'h-12 w-12' : 'h-14 w-14')} />
      <div className="min-w-0">
        <div className={cn('whitespace-nowrap font-bold tracking-tight', compact ? 'text-sm' : 'text-base', inverse ? 'text-white' : 'text-foreground')}>PayNexus PMS</div>
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.16em]', inverse ? 'text-slate-400' : 'text-muted-foreground')}>People operations</div>
        {institutions && <div className="mt-2 flex items-center gap-2">
          <img src={publicAsset('ccte.png')} alt="CCTE" className={cn('object-contain', loginDisplay ? 'h-7 w-7' : 'h-6 w-6')} />
          <img src={publicAsset('lcc.png')} alt="Lipa City Colleges" className={cn('object-contain', loginDisplay ? 'h-7 w-7' : 'h-6 w-6')} />
          <span className={cn('font-semibold leading-tight', loginDisplay ? 'text-[11px]' : 'text-[10px]', inverse ? 'text-slate-400' : 'text-muted-foreground')}>Lipa City Colleges<br />CCTE</span>
        </div>}
      </div>
    </div>
  )
}
