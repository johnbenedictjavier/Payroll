import { Activity, ArrowRight, CalendarClock, CircleDollarSign, Clock3, Landmark, UserCheck, UsersRound, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { StatCard } from '@/components/dashboard/stat-card'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDashboardStats, listPayrollPeriods } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}${name}`

export function AdminDashboardPage() {
  const stats = useQuery({ queryKey: ['admin-dashboard'], queryFn: getDashboardStats })
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })

  return (
    <div>
      <PageHeading eyebrow="Administrator portal" title="Good morning, administrator." description="A live view of your workforce, payroll readiness, and the next operational actions." action={{ label: 'Open payroll workspace', to: '/admin/payroll' }} />
      <AdminHero />
      {stats.isError && <Alert variant="danger" className="mb-6">The PMS dashboard could not load. Verify that this account has administrator access and try again.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40" />) : (
          <>
            <StatCard label="Registered employees" value={stats.data?.totalEmployees ?? 0} detail={`${stats.data?.activeEmployees ?? 0} currently active`} icon={UsersRound} tone="teal" />
            <StatCard label="Departments" value={stats.data?.totalDepartments ?? 0} detail="Active organizational units" icon={Landmark} tone="navy" />
            <StatCard label="Positions" value={stats.data?.totalPositions ?? 0} detail="Available assignments" icon={UserCheck} tone="violet" />
            <StatCard label="Outstanding loans" value={formatCurrency(stats.data?.outstandingLoans)} detail="Active principal balance" icon={WalletCards} tone="amber" />
          </>
        )}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div><CardTitle>Payroll readiness</CardTitle><CardDescription>Current periods and their approval state.</CardDescription></div>
            <CalendarClock className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {periods.isLoading ? <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : periods.data?.length ? (
              <div className="space-y-3">
                {periods.data.slice(0, 4).map((period) => (
                  <div key={period.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><div className="font-semibold">{period.name}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(period.start_date)} to {formatDate(period.end_date)} · Pay date {formatDate(period.pay_date)}</div></div>
                    <div className="flex items-center gap-3"><Badge variant={period.status === 'finalized' || period.status === 'paid' ? 'success' : period.status === 'cancelled' ? 'danger' : 'warning'}>{period.status}</Badge><Link to={`/admin/payroll?period=${period.id}`} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary"><ArrowRight className="h-4 w-4" /></Link></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">No payroll periods yet</p><p className="mt-1 text-sm text-muted-foreground">Create the first configurable period to start collecting attendance and deductions.</p><Link to="/admin/payroll" className="mt-4 inline-flex"><Button size="sm">Create payroll period</Button></Link></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle><CardDescription>Common administrator workflows.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <QuickAction to="/admin/employees/new" icon={UsersRound} label="Add employee" detail="Create a complete employee profile" />
            <QuickAction to="/admin/employees" icon={UsersRound} label="Review employees" detail="Manage records and requests" />
            <QuickAction to="/admin/organization" icon={Landmark} label="Organization setup" detail="Departments and positions" />
            <QuickAction to="/admin/attendance" icon={Activity} label="Enter attendance" detail="Prepare a payroll period" />
            <QuickAction to="/admin/reports" icon={CircleDollarSign} label="View reports" detail="Finalized payroll analytics" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AdminHero() {
  return (
    <section className="relative mb-6 overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
        <div>
          <div className="flex flex-wrap items-center gap-3"><img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-12 w-28 object-contain" /><span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">PMS operations</span></div>
          <h2 className="mt-7 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Keep every people decision connected to payday.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">Build a clean employee record, confirm the organization structure, and move into payroll with fewer unknowns.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link to="/admin/employees/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-200">Add an employee <ArrowRight className="h-4 w-4" /></Link><Link to="/admin/organization" className="inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Review organization</Link></div>
        </div>
        <div className="flex items-end justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
          <div><div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Built for</div><div className="mt-3 text-xl font-black">Lipa City Colleges</div><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">A single workspace for people records, attendance, payroll review, and payslips.</p></div>
          <div className="flex shrink-0 items-center gap-2"><img src={publicAsset('ccte.png')} alt="CCTE" className="h-12 w-12 rounded-xl bg-white object-contain p-1" /><img src={publicAsset('lcc.png')} alt="Lipa City Colleges" className="h-12 w-12 rounded-xl bg-white object-contain p-1" /></div>
        </div>
      </div>
    </section>
  )
}

function QuickAction({ to, icon: Icon, label, detail }: { to: string; icon: typeof UsersRound; label: string; detail: string }) {
  return <Link to={to} className="flex items-center gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-primary/5"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>
}
