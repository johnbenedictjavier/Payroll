import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({ label, value, detail, icon: Icon, tone = 'teal', trend }: { label: string; value: string | number; detail?: string; icon: LucideIcon; tone?: 'teal' | 'navy' | 'amber' | 'violet'; trend?: number }) {
  return <Card className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="section-kicker text-muted-foreground">{label}</p><p className="money mt-3 truncate text-2xl font-black">{value}</p>{detail && <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>}{trend !== undefined && <span className={cn('mt-3 inline-flex items-center gap-1 text-xs font-bold', trend >= 0 ? 'text-emerald-600' : 'text-red-600')}>{trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(trend)}% from last period</span>}</div><div className={cn('rounded-lg p-2.5', tone === 'teal' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300', tone === 'navy' && 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', tone === 'amber' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', tone === 'violet' && 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300')}><Icon className="h-5 w-5" /></div></div></Card>
}
