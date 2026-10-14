import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export function PageHeading({ eyebrow, title, description, action, actions }: { eyebrow?: string; title: string; description?: string; action?: { label: string; to: string }; actions?: ReactNode }) {
  const headingActions = actions ?? (action ? <Link to={action.to} className="action-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold sm:w-auto">{action.label}<ArrowUpRight className="h-4 w-4" /></Link> : null)
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="min-w-0"><div className="section-kicker mb-2">{eyebrow}</div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{headingActions && <div className="w-full print:hidden sm:w-auto">{headingActions}</div>}</div>
}
