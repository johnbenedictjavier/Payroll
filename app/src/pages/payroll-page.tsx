import { useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, Plus, RefreshCw, ShieldAlert } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createPayrollPeriod, finalizePayroll, listPayrollPeriods, listPayrollRecords, markPayrollPaid, previewPayroll, publishPayslips } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { PayrollPeriod, PayrollRecord } from '@/types/database'

type PeriodForm = { name: string; start_date: string; end_date: string; pay_date: string; frequency: PayrollPeriod['frequency'] }
const blankPeriod: PeriodForm = { name: '', start_date: '', end_date: '', pay_date: '', frequency: 'monthly' }

export function PayrollPage() {
  const queryClient = useQueryClient()
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(blankPeriod)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')
  const selectedPeriod = periods.data?.find((period) => period.id === selectedId) ?? periods.data?.[0]
  const records = useQuery({ queryKey: ['payroll-records', selectedPeriod?.id], queryFn: () => listPayrollRecords(selectedPeriod?.id), enabled: Boolean(selectedPeriod?.id) })
  const preview = useQuery({ queryKey: ['payroll-preview', selectedPeriod?.id], queryFn: () => previewPayroll(selectedPeriod!.id), enabled: false })
  const createMutation = useMutation({ mutationFn: () => createPayrollPeriod(form), onSuccess: (created) => { setDialogOpen(false); setForm(blankPeriod); setSelectedId(created.id); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const finalizeMutation = useMutation({ mutationFn: () => finalizePayroll(selectedPeriod!.id, crypto.randomUUID()), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }); void queryClient.invalidateQueries({ queryKey: ['payroll-records'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const paidMutation = useMutation({ mutationFn: () => markPayrollPaid(selectedPeriod!.id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const publishMutation = useMutation({ mutationFn: () => publishPayslips(selectedPeriod!.id), onSuccess: () => { setError('Payslips published.'); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) }, onError: (mutationError) => setError((mutationError as Error).message) })
  const previewRecords = (preview.data ?? []) as PayrollRecord[]
  const displayedRecords = preview.isSuccess ? previewRecords : (records.data ?? [])
  const totals = useMemo(() => displayedRecords.reduce((result, record) => ({ gross: result.gross + Number(record.gross_pay || 0), deductions: result.deductions + Number(record.total_deductions || 0), net: result.net + Number(record.net_pay || 0) }), { gross: 0, deductions: 0, net: 0 }), [displayedRecords])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.name || !form.start_date || !form.end_date || !form.pay_date) {
      setError('All payroll period fields are required.')
      return
    }
    if (form.end_date < form.start_date || form.pay_date < form.end_date) {
      setError('End date must follow start date, and pay date must be on or after the end date.')
      return
    }
    createMutation.mutate()
  }

  function selectPeriod(id: string) {
    setSelectedId(id)
    queryClient.removeQueries({ queryKey: ['payroll-preview', id] })
    setError('')
  }

  function requestPreview() {
    if (!selectedPeriod) return
    queryClient.removeQueries({ queryKey: ['payroll-preview', selectedPeriod.id] })
    void preview.refetch()
  }

  return <div>
    <PageHeading eyebrow="Payroll operations" title="Payroll processing" description="Create a period, validate live inputs, review a server-side preview, and finalize only after approval." />
    <div className="grid gap-6 xl:grid-cols-[0.35fr_0.65fr]">
      <Card className="h-fit"><CardHeader><div className="flex items-start justify-between"><div><CardTitle>Payroll periods</CardTitle><CardDescription>{periods.data?.length ?? 0} configured periods.</CardDescription></div><Button size="sm" onClick={() => { setError(''); setForm(blankPeriod); setDialogOpen(true) }}><Plus className="h-4 w-4" />New</Button></div></CardHeader><CardContent>{periods.isLoading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : periods.data?.length ? <div className="space-y-2">{periods.data.map((period) => <button key={period.id} onClick={() => selectPeriod(period.id)} className={`w-full rounded-xl border p-4 text-left transition ${selectedPeriod?.id === period.id ? 'border-primary bg-primary/5' : 'hover:bg-secondary/60'}`}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{period.name}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(period.start_date)} - {formatDate(period.end_date)}</div></div><ChevronRight className="h-4 w-4 text-muted-foreground" /></div><div className="mt-3 flex items-center justify-between"><Badge variant={period.status === 'finalized' || period.status === 'paid' ? 'success' : period.status === 'cancelled' ? 'danger' : 'warning'}>{period.status}</Badge><span className="text-[11px] text-muted-foreground">Pay {formatDate(period.pay_date)}</span></div></button>)}</div> : <EmptyState title="No payroll periods" description="Create a period before collecting attendance and payroll inputs." />}</CardContent></Card>
      <div className="space-y-6">
        {error && <Alert variant="danger">{error}</Alert>}
        {selectedPeriod ? <>
          <Card><CardHeader className="flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-3"><CardTitle>{selectedPeriod.name}</CardTitle><Badge variant={selectedPeriod.status === 'finalized' || selectedPeriod.status === 'paid' ? 'success' : 'warning'}>{selectedPeriod.status}</Badge></div><CardDescription className="mt-2">{formatDate(selectedPeriod.start_date)} to {formatDate(selectedPeriod.end_date)} · Pay date {formatDate(selectedPeriod.pay_date)}</CardDescription></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={requestPreview} disabled={preview.isFetching || ['finalized', 'paid', 'cancelled'].includes(selectedPeriod.status)}><RefreshCw className={`h-4 w-4 ${preview.isFetching ? 'animate-spin' : ''}`} />Preview</Button>{!['finalized', 'paid', 'cancelled'].includes(selectedPeriod.status) && <Button size="sm" onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}><FileCheck2 className="h-4 w-4" />Finalize</Button>}{selectedPeriod.status === 'finalized' && <Button size="sm" onClick={() => paidMutation.mutate()} disabled={paidMutation.isPending}><CheckCircle2 className="h-4 w-4" />Mark paid</Button>}{(selectedPeriod.status === 'finalized' || selectedPeriod.status === 'paid') && <Button size="sm" variant="outline" onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}><FileCheck2 className="h-4 w-4" />Publish payslips</Button>}</div></CardHeader><CardContent><div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary label="Gross pay" value={formatCurrency(totals.gross)} /><Summary label="Deductions" value={formatCurrency(totals.deductions)} /><Summary label="Net pay" value={formatCurrency(totals.net)} /></div>{preview.isError && <Alert variant="warning" className="mb-4"><ShieldAlert className="mr-2 inline h-4 w-4" />{(preview.error as Error).message}. Complete missing policy, salary, attendance, or statutory inputs before finalization.</Alert>}{records.isLoading || preview.isFetching ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : displayedRecords.length ? <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Basic pay</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead className="text-right">Net pay</TableHead></TableRow></TableHeader><TableBody>{displayedRecords.map((record) => <TableRow key={record.id}><TableCell><div className="font-semibold">{record.employee ? `${record.employee.last_name}, ${record.employee.first_name}` : 'Employee'}</div><div className="text-xs text-muted-foreground">{record.employee?.employee_number ?? record.employee_id}</div></TableCell><TableCell>{formatCurrency(record.basic_pay)}</TableCell><TableCell>{formatCurrency(record.gross_pay)}</TableCell><TableCell>{formatCurrency(record.total_deductions)}</TableCell><TableCell className="text-right font-bold text-primary">{formatCurrency(record.net_pay)}</TableCell></TableRow>)}</TableBody></Table> : <EmptyState title={preview.isSuccess ? 'No eligible employees' : 'No payroll records yet'} description={preview.isSuccess ? 'Check active employees and effective salary records.' : 'Run a server-side preview after configuring payroll inputs.'} />}</CardContent></Card>
          <Card><CardHeader><CardTitle>Processing controls</CardTitle><CardDescription>Finalization creates an immutable audit snapshot and loan repayment transaction.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-3"><Control label="Inputs" value="Database records" /><Control label="Calculation" value="PostgreSQL function" /><Control label="Finalization" value="Atomic transaction" /></CardContent></Card>
        </> : <Card><CardContent className="py-16"><EmptyState title="Select a payroll period" description="Choose an existing period or create a new one to begin." /></CardContent></Card>}
      </div>
    </div>
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create payroll period" description="Periods cannot overlap another regular payroll period."><form onSubmit={submit} className="space-y-5">{error && <Alert variant="danger">{error}</Alert>}<div><Label>Period name</Label><Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="October 2026 - First Cutoff" required /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Frequency</Label><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as PeriodForm['frequency'] }))}><option value="monthly">Monthly</option><option value="semi_monthly">Semi-monthly</option><option value="special">Special payroll</option></select></div><div><Label>Pay date</Label><Input type="date" value={form.pay_date} onChange={(event) => setForm((current) => ({ ...current, pay_date: event.target.value }))} required /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} required /></div><div><Label>End date</Label><Input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} required /></div></div><div className="flex justify-end gap-2 border-t pt-5"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create period'}</Button></div></form></Dialog>
  </div>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary/60 p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-xl font-black">{value}</div></div> }
function Control({ label, value }: { label: string; value: string }) { return <div className="flex items-center gap-3 rounded-xl border p-3"><CircleDollarSign className="h-4 w-4 text-primary" /><div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div></div> }
