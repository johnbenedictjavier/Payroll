import { Activity, ArrowRight, CalendarClock, CircleDollarSign, Clock3, Landmark, Search, UserCheck, UsersRound, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { StatCard } from '@/components/dashboard/stat-card'
import { getDashboardStats, listPayrollPeriods } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminDashboardPage() {
  const stats = useQuery({ queryKey: ['admin-dashboard'], queryFn: getDashboardStats })
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const [periodSearch, setPeriodSearch] = useState('')
  const activePayroll = stats.data?.activePayroll
  const visiblePeriods = periods.data?.filter((period) => `${period.name} ${period.status} ${period.frequency} ${period.start_date} ${period.end_date}`.toLowerCase().includes(periodSearch.trim().toLowerCase())) ?? []

  return <div className="space-y-6">
    <PageHeading eyebrow="Administrator workspace" title="Good morning, administrator." description="A live view of people, payroll readiness, and the next action that keeps payday moving." action={{ label: 'Open payroll', to: '/admin/payroll' }} />

    <section className="overflow-hidden rounded-2xl bg-slate-950 p-5 text-white shadow-banking sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">Payroll control center</span>{activePayroll && <Badge variant={activePayroll.status === 'paid' ? 'success' : 'warning'}>{activePayroll.status}</Badge>}</div>
          <h2 className="mt-5 max-w-xl text-2xl font-black tracking-tight sm:text-4xl">Keep every employee decision ready for payday.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Review the current period, resolve missing inputs, and move approved payroll through its controlled stages.</p>
          <div className="mt-5 flex flex-wrap gap-3"><Link to="/admin/payroll" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-200">Review current period <ArrowRight className="h-4 w-4" /></Link><Link to="/admin/employees/new" className="inline-flex min-h-10 items-center rounded-lg border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Add employee</Link></div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.06] p-5">
          <div className="section-kicker text-emerald-300">Current pay cycle</div>
          <div className="mt-3 text-xl font-black">{activePayroll?.name ?? 'No active period'}</div>
          <div className="mt-2 text-sm text-slate-400">{activePayroll ? `${formatDate(activePayroll.start_date)} to ${formatDate(activePayroll.end_date)}` : 'Create a period to begin collecting payroll inputs.'}</div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-4"><div><div className="text-xs text-slate-400">Pay date</div><div className="mt-1 font-bold">{activePayroll ? formatDate(activePayroll.pay_date) : 'Not scheduled'}</div></div><div><div className="text-xs text-slate-400">Payroll expense</div><div className="money mt-1 font-bold">{formatCurrency(stats.data?.payrollExpense)}</div></div></div>
        </div>
      </div>
    </section>

    {stats.isError && <Alert variant="danger">The dashboard could not load. Verify administrator access and try again.</Alert>}
    {periods.isError && <Alert variant="warning">Payroll readiness details could not be loaded. The dashboard metrics are still available.</Alert>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.isLoading ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-36" />) : <><StatCard label="Registered employees" value={stats.data?.totalEmployees ?? 0} detail={`${stats.data?.activeEmployees ?? 0} currently active`} icon={UsersRound} tone="teal" /><StatCard label="Departments" value={stats.data?.totalDepartments ?? 0} detail="Active organizational units" icon={Landmark} tone="navy" /><StatCard label="Positions" value={stats.data?.totalPositions ?? 0} detail="Available assignments" icon={UserCheck} tone="violet" /><StatCard label="Payroll expense" value={formatCurrency(stats.data?.payrollExpense)} detail="Current active period" icon={CircleDollarSign} tone="teal" /><StatCard label="Outstanding loans" value={formatCurrency(stats.data?.outstandingLoans)} detail="Active principal balance" icon={WalletCards} tone="amber" /></>}</div>

    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Payroll readiness</CardTitle><CardDescription>Open a period to review its inputs and status.</CardDescription></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={periodSearch} onChange={(event) => setPeriodSearch(event.target.value)} placeholder="Search periods" className="pl-9" /></div></CardHeader>
        <CardContent>{periods.isLoading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : visiblePeriods.length ? <div className="space-y-2">{visiblePeriods.slice(0, 6).map((period) => <Link key={period.id} to={`/admin/payroll?period=${period.id}`} className="flex items-center gap-3 rounded-lg border p-4 transition hover:border-primary/40 hover:bg-primary/5"><div className="min-w-0 flex-1"><div className="truncate font-semibold">{period.name}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(period.start_date)} to {formatDate(period.end_date)} · Pay {formatDate(period.pay_date)}</div></div><Badge variant={period.status === 'finalized' || period.status === 'paid' ? 'success' : period.status === 'cancelled' ? 'danger' : 'warning'}>{period.status}</Badge><ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" /></Link>)}</div> : periods.data?.length ? <div className="rounded-lg border border-dashed p-8 text-center"><p className="font-semibold">No matching periods</p><p className="mt-1 text-sm text-muted-foreground">Adjust your search to see other periods.</p></div> : <div className="rounded-lg border border-dashed p-8 text-center"><Clock3 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-semibold">No payroll periods yet</p><p className="mt-1 text-sm text-muted-foreground">Create a period before entering attendance.</p></div>}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Operations queue</CardTitle><CardDescription>Shortcuts for the work that keeps payroll moving.</CardDescription></CardHeader>
        <CardContent className="space-y-2"><QueueAction to="/admin/employees/new" icon={UsersRound} label="Add employee" detail="Create a complete profile" /><QueueAction to="/admin/employees" icon={UserCheck} label="Review employees" detail="Manage records and portal access" /><QueueAction to="/admin/attendance" icon={Activity} label="Enter attendance" detail="Prepare a payroll period" /><QueueAction to="/admin/reports" icon={CircleDollarSign} label="View reports" detail="Review finalized payroll" /></CardContent>
      </Card>
    </div>
  </div>
}

function QueueAction({ to, icon: Icon, label, detail }: { to: string; icon: typeof UsersRound; label: string; detail: string }) {
  return <Link to={to} className="flex items-center gap-3 rounded-lg border p-3 transition hover:border-primary/40 hover:bg-primary/5"><div className="rounded-lg bg-primary/10 p-2.5 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{label}</div><div className="truncate text-xs text-muted-foreground">{detail}</div></div><ArrowRight className="h-4 w-4 text-muted-foreground" /></Link>
}
