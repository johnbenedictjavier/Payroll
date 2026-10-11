import { useMemo, useState } from 'react'
import { Download, FileBarChart, Filter } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listPayrollPeriods, listPayrollRecords } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'

export function ReportsPage() {
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const [periodId, setPeriodId] = useState('')
  const records = useQuery({ queryKey: ['report-payroll-records', periodId], queryFn: () => listPayrollRecords(periodId || undefined), enabled: periods.isSuccess })
  const finalizedPeriodIds = new Set((periods.data ?? []).filter((period) => period.status === 'finalized' || period.status === 'paid').map((period) => period.id))
  const finalizedRecords = records.data?.filter((record) => finalizedPeriodIds.has(record.payroll_period_id) && (!periodId || record.payroll_period_id === periodId)) ?? []
  const chartData = useMemo(() => { const grouped = new Map<string, number>(); finalizedRecords.forEach((record) => { const key = record.employee?.last_name ?? 'Employee'; grouped.set(key, (grouped.get(key) ?? 0) + Number(record.net_pay || 0)) }); return Array.from(grouped, ([name, netPay]) => ({ name, netPay })).slice(0, 10) }, [finalizedRecords])
  const totals = finalizedRecords.reduce((result, record) => ({ gross: result.gross + Number(record.gross_pay || 0), deductions: result.deductions + Number(record.total_deductions || 0), net: result.net + Number(record.net_pay || 0) }), { gross: 0, deductions: 0, net: 0 })

  function exportCsv() {
    const header = ['Employee number', 'Employee name', 'Gross pay', 'Total deductions', 'Net pay']
    const rows = finalizedRecords.map((record) => [record.employee?.employee_number ?? record.employee_id, record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : 'Employee', record.gross_pay, record.total_deductions, record.net_pay])
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `payroll-report-${periodId || 'all'}.csv`; anchor.click(); URL.revokeObjectURL(url)
  }

  return <div><PageHeading eyebrow="Insights" title="Reports and analytics" description="Review finalized payroll records using real database transactions. Draft calculations are not presented as historical reports." /><Card className="mb-6"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between"><div className="w-full sm:max-w-sm"><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payroll period filter</label><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">All finalized records</option>{periods.data?.filter((period) => period.status === 'finalized' || period.status === 'paid').map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></div><Button variant="outline" onClick={exportCsv} disabled={!finalizedRecords.length}><Download className="h-4 w-4" />Export CSV</Button></CardContent></Card>{records.isError && <Alert variant="danger" className="mb-6">{(records.error as Error).message}</Alert>}<div className="grid gap-4 sm:grid-cols-3"><Metric label="Gross pay" value={formatCurrency(totals.gross)} /><Metric label="Deductions" value={formatCurrency(totals.deductions)} /><Metric label="Net pay" value={formatCurrency(totals.net)} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"><Card><CardHeader><CardTitle>Net pay by employee</CardTitle><CardDescription>Top ten employees in the selected finalized records.</CardDescription></CardHeader><CardContent className="h-80">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `₱${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="netPay" fill="#0f766e" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="No finalized data" description="Finalize payroll before generating historical charts." />}</CardContent></Card><Card><CardHeader><CardTitle>Finalized payroll</CardTitle><CardDescription>Actual records available for reporting.</CardDescription></CardHeader><CardContent>{records.isLoading ? <div className="space-y-3"><div className="h-10 animate-pulse rounded bg-secondary" /><div className="h-10 animate-pulse rounded bg-secondary" /></div> : finalizedRecords.length ? <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead className="text-right">Net pay</TableHead></TableRow></TableHeader><TableBody>{finalizedRecords.slice(0, 8).map((record) => { const period = periods.data?.find((item) => item.id === record.payroll_period_id); return <TableRow key={record.id}><TableCell><div className="font-semibold">{record.employee?.last_name}, {record.employee?.first_name}</div><div className="text-xs text-muted-foreground">{record.employee?.employee_number}</div></TableCell><TableCell className="text-xs text-muted-foreground">{period ? `${formatDate(period.start_date)} - ${formatDate(period.end_date)}` : 'Unknown period'}</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(record.net_pay)}</TableCell></TableRow> })}</TableBody></Table> : <EmptyState title="No report records" description="Only finalized or paid payroll records appear here." />}</CardContent></Card></div></div>
}

function Metric({ label, value }: { label: string; value: string }) { return <Card className="p-5"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><Filter className="h-3.5 w-3.5 text-primary" />{label}</div><div className="mt-3 text-2xl font-black">{value}</div></Card> }
