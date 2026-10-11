import { ArrowUpRight, CalendarDays, ChevronRight, Clock3, FileText, HandCoins, ReceiptText, UserRound, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmployeeAvatar } from '@/components/profile/employee-avatar'
import { PageHeading } from '@/components/layout/page-heading'
import { useAuth } from '@/contexts/auth-context'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { listAttendance, listEmployeeLoans, listPayrollPeriods, listPayrollRecords } from '@/services/api'
import { formatCurrency, formatDate, titleCase } from '@/lib/utils'

export function EmployeeDashboardPage() {
  const { employee } = useAuth()
  const payroll = useQuery({ queryKey: ['my-payroll'], queryFn: () => listPayrollRecords() })
  const loans = useQuery({ queryKey: ['my-loans'], queryFn: listEmployeeLoans })
  const periods = useQuery({ queryKey: ['my-periods'], queryFn: listPayrollPeriods })
  const attendance = useQuery({ queryKey: ['my-attendance'], queryFn: () => listAttendance() })
  const ownLoans = loans.data?.filter((loan) => loan.employee_id === employee?.id) ?? []
  const ownPayroll = payroll.data?.filter((record) => record.employee_id === employee?.id) ?? []
  const ownAttendance = attendance.data?.filter((record) => record.employee_id === employee?.id) ?? []
  const latestPay = ownPayroll[0]
  const latestAttendance = ownAttendance[0]
  const latestPeriod = periods.data?.find((period) => period.id === latestPay?.payroll_period_id)
  const activeLoans = ownLoans.filter((loan) => loan.status === 'active')
  const activeLoanBalance = activeLoans.reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0)
  const hasError = payroll.isError || loans.isError || periods.isError || attendance.isError
  const displayName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'colleague'

  return <div className="space-y-6">
    <PageHeading eyebrow="Employee portal" title={`Welcome, ${employee?.first_name || 'colleague'}.`} description="Your private view of earnings, attendance, payslips, and active loans." action={{ label: 'View my profile', to: '/employee/profile' }} />
    {hasError && <Alert variant="danger">Some account information could not be loaded. Refresh the page or contact your administrator if the problem continues.</Alert>}
    <section className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="relative">
        <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><EmployeeAvatar photoPath={employee?.photo_path} name={displayName} className="h-12 w-12 border border-white/20 bg-white/10 text-white" alt={displayName} /><div><div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Payroll wallet</div><div className="mt-1 text-sm text-slate-300">{displayName}</div></div></div><WalletCards className="h-7 w-7 text-emerald-200" /></div>
        <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Latest take-home pay</div><div className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{payroll.isLoading ? <span className="inline-block h-12 w-48 animate-pulse rounded-lg bg-white/10" /> : latestPay ? formatCurrency(latestPay.net_pay) : 'Not published'}</div><div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">{latestPeriod ? <><span>{latestPeriod.name}</span><span className="text-slate-500">·</span><span>Pay date {formatDate(latestPeriod.pay_date)}</span></> : <span>Your finalized payroll will appear here.</span>}</div></div><Link to="/employee/payslips" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-200">Open payslips <ArrowUpRight className="h-4 w-4" /></Link></div>
      </div>
    </section>
    <section><div className="mb-3 flex items-end justify-between"><div><div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Shortcuts</div><h2 className="mt-1 text-lg font-black">What do you need today?</h2></div></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><QuickAction to="/employee/attendance" icon={CalendarDays} label="Attendance" detail="Review your records" /><QuickAction to="/employee/payroll" icon={ReceiptText} label="Payroll" detail="See finalized pay" /><QuickAction to="/employee/payslips" icon={FileText} label="Payslips" detail="Download documents" /><QuickAction to="/employee/profile" icon={UserRound} label="Profile" detail="Keep details current" /></div></section>
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Recent payroll activity</CardTitle><CardDescription>Your latest published payroll records.</CardDescription></div><Link to="/employee/payroll" className="text-sm font-semibold text-primary hover:underline">View all</Link></CardHeader><CardContent>{payroll.isLoading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : ownPayroll.length === 0 ? <EmptyState title="No published payroll yet" description="Your administrator will publish payroll after finalization." /> : <div className="space-y-3">{ownPayroll.slice(0, 4).map((record) => { const period = periods.data?.find((item) => item.id === record.payroll_period_id); return <div key={record.id} className="flex items-center gap-3 rounded-2xl border p-4"><div className="rounded-xl bg-primary/10 p-3 text-primary"><ReceiptText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate font-semibold">{period?.name ?? 'Payroll record'}</div><div className="mt-1 text-xs text-muted-foreground">{period ? `${formatDate(period.start_date)} to ${formatDate(period.end_date)}` : 'Period details unavailable'}</div></div><div className="text-right"><div className="font-black text-primary">{formatCurrency(record.net_pay)}</div><Badge variant="success">Finalized</Badge></div></div> })}</div>}</CardContent></Card>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Money snapshot</CardTitle><CardDescription>Quick view of your current payroll picture.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-4"><Metric label="Active loans" value={formatCurrency(activeLoanBalance)} icon={HandCoins} tone="amber" /><Metric label="Days worked" value={latestAttendance?.days_worked ?? 0} icon={Clock3} tone="teal" /><Metric label="Employment" value={titleCase(employee?.status) || 'Not set'} icon={UserRound} tone="violet" /><Metric label="Department" value={employee?.department?.name ?? 'Unassigned'} icon={WalletCards} tone="navy" /></CardContent></Card><Card><CardContent className="flex items-center gap-4 p-5"><EmployeeAvatar photoPath={employee?.photo_path} name={displayName} className="h-14 w-14 text-lg" /><div className="min-w-0 flex-1"><div className="font-bold">Profile snapshot</div><div className="truncate text-sm text-muted-foreground">{employee?.position?.name ?? 'Position not assigned'}</div><Link to="/employee/profile" className="mt-2 inline-flex items-center text-sm font-semibold text-primary hover:underline">Manage profile <ChevronRight className="h-4 w-4" /></Link></div></CardContent></Card></div>
    </div>
  </div>
}

function QuickAction({ to, icon: Icon, label, detail }: { to: string; icon: typeof CalendarDays; label: string; detail: string }) { return <Link to={to} className="group rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"><div className="flex items-center justify-between"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></div><div className="mt-4 text-sm font-bold">{label}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></Link> }

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof HandCoins; tone: 'amber' | 'teal' | 'violet' | 'navy' }) { const tones = { amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200', teal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200', violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-200', navy: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' }; return <div className="min-w-0"><div className={`mb-2 inline-flex rounded-xl p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></div><div className="truncate text-lg font-black">{value}</div><div className="truncate text-xs text-muted-foreground">{label}</div></div> }
