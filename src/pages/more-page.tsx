import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { navGroupsForRole } from '@/components/navigation/navigation-config'
import { PageHeading } from '@/components/layout/page-heading'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function MorePage() {
  const { role } = useAuth()
  const groups = navGroupsForRole(role)

  return <div><PageHeading eyebrow="More" title="More workspace tools" description="Browse every section available to your account." /><Card className="max-w-3xl"><CardHeader><CardTitle>Workspace directory</CardTitle><CardDescription>Choose a section to continue.</CardDescription></CardHeader><CardContent className="space-y-6">{groups.map((group) => <section key={group.id}><h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</h2><div className="grid gap-3 sm:grid-cols-2">{group.items.map(({ label, description, to, icon: Icon }) => <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border p-4 transition hover:border-primary/40 hover:bg-primary/5"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="font-semibold">{label}</div><div className="text-xs text-muted-foreground">{description}</div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>)}</div></section>)}</CardContent></Card></div>
}
