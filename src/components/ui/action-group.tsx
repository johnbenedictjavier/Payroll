import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end print:hidden', className)}>{children}</div>
}
