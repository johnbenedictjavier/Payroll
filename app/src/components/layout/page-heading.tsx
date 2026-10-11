import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: { label: string; to: string } }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}</div>{action && <Link to={action.to} className="pms-gradient inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white shadow-sm transition hover:brightness-105 sm:w-auto">{action.label}<ArrowUpRight className="h-4 w-4" /></Link>}</div>
}
