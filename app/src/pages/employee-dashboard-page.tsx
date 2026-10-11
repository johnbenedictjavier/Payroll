import { ArrowRight, CalendarDays, FileText, HandCoins, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { PageHeading } from '@/components/layout/page-heading'
import { StatCard } from '@/components/dashboard/stat-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { listAttendance, listEmployeeLoans, listPayrollPeriods, listPayrollRecords } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'

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
  return <div><PageHeading eyebrow="Employee portal" title={`Welcome, ${employee?.first_name || 'colleague'}.`} description="Your private view of attendance, payroll, payslips, and active loans." action={{ label: 'View my profile', to: '/employee/profile' }} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Latest net pay" value={latestPay ? formatCurrency(latestPay.net_pay) : 'Not published'} detail={latestPay ? 'From your latest finalized payroll' : 'Published payslip will appear here'} icon={FileText} tone="teal" /><StatCard label="Active loan balance" value={formatCurrency(ownLoans.filter((loan) => loan.status === 'active').reduce((sum, loan) => sum + Number(loan.outstanding_balance), 0))} detail={`${ownLoans.filter((loan) => loan.status === 'active').length} active loan(s)`} icon={HandCoins} tone="amber" /><StatCard label="Recent days worked" value={latestAttendance?.days_worked ?? 0} detail="Latest attendance record" icon={CalendarDays} tone="navy" /><StatCard label="Employment status" value={employee?.status === 'active' ? 'Active' : employee?.status ?? 'Not set'} detail={employee?.department?.name ?? 'Department not assigned'} icon={UserRound} tone="violet" /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2"><Card><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Recent payslips</CardTitle><CardDescription>Published payroll records visible only to you.</CardDescription></div><Link to="/employee/payslips" className="text-sm font-semibold text-primary hover:underline">View all</Link></CardHeader><CardContent>{payroll.isLoading ? <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-14" /></div> : ownPayroll.length === 0 ? <EmptyState title="No published payroll yet" description="Your published payslips will appear here after administrator finalization." /> : <div className="space-y-3">{ownPayroll.slice(0, 4).map((record) => { const period = periods.data?.find((item) => item.id === record.payroll_period_id); return <div key={record.id} className="flex items-center justify-between rounded-xl border p-4"><div><div className="font-semibold">{period?.name ?? 'Payroll record'}</div><div className="mt-1 text-xs text-muted-foreground">{period ? `${formatDate(period.start_date)} to ${formatDate(period.end_date)}` : 'Period details unavailable'}</div></div><div className="text-right"><div className="font-bold text-primary">{formatCurrency(record.net_pay)}</div><Badge variant="success">Finalized</Badge></div></div> })}</div>}</CardContent></Card><Card><CardHeader><CardTitle>Profile snapshot</CardTitle><CardDescription>Confirm that your employment information is current.</CardDescription></CardHeader><CardContent><div className="rounded-xl bg-secondary/60 p-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{(employee?.first_name?.[0] ?? '') + (employee?.last_name?.[0] ?? '')}</div><div><div className="font-bold">{employee ? `${employee.first_name} ${employee.last_name}` : 'Employee profile'}</div><div className="text-sm text-muted-foreground">{employee?.position?.name ?? 'Position not assigned'}</div></div></div><div className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><span className="text-muted-foreground">Employee number</span><div className="font-semibold">{employee?.employee_number ?? 'Not set'}</div></div><div><span className="text-muted-foreground">Email</span><div className="truncate font-semibold">{employee?.email ?? 'Not set'}</div></div></div></div><Link to="/employee/profile" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Open profile <ArrowRight className="h-4 w-4" /></Link></CardContent></Card></div>
  </div>
}
