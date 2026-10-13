import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, Plus, RefreshCw, Search, ShieldAlert, UsersRound } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
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
type ConfirmAction = 'finalize' | 'paid' | 'publish' | null
const blankPeriod: PeriodForm = { name: '', start_date: '', end_date: '', pay_date: '', frequency: 'monthly' }

export function PayrollPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(blankPeriod)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [error, setError] = useState('')
  const [periodSearch, setPeriodSearch] = useState('')
  const [periodStatus, setPeriodStatus] = useState<PayrollPeriod['status'] | 'all'>('all')
  const [recordSearch, setRecordSearch] = useState('')

  const selectedPeriod = periods.data?.find((period) => period.id === selectedId) ?? periods.data?.[0]
  const visiblePeriods = periods.data?.filter((period) => {
    const matchesStatus = periodStatus === 'all' || period.status === periodStatus
    return matchesStatus && `${period.name} ${period.frequency} ${period.status} ${period.start_date} ${period.end_date} ${period.pay_date}`.toLowerCase().includes(periodSearch.trim().toLowerCase())
  }) ?? []
  const records = useQuery({ queryKey: ['payroll-records', selectedPeriod?.id], queryFn: () => listPayrollRecords(selectedPeriod?.id), enabled: Boolean(selectedPeriod?.id) })
  const preview = useQuery({ queryKey: ['payroll-preview', selectedPeriod?.id], queryFn: () => previewPayroll(selectedPeriod!.id), enabled: false })

  useEffect(() => {
    if (!periods.data?.length) return
    const requested = searchParams.get('period')
    const hasRequested = Boolean(requested && periods.data.some((period) => period.id === requested))
    const hasSelected = Boolean(selectedId && periods.data.some((period) => period.id === selectedId))
    if (requested && !hasRequested && selectedId && !hasSelected) return
    const nextId = requested && periods.data.some((period) => period.id === requested) ? requested : selectedId && periods.data.some((period) => period.id === selectedId) ? selectedId : periods.data[0].id
    if (nextId !== selectedId) setSelectedId(nextId)
    if (requested !== nextId) setSearchParams({ period: nextId }, { replace: true })
  }, [periods.data, searchParams, selectedId, setSearchParams])

  const createMutation = useMutation({
    mutationFn: () => createPayrollPeriod(form),
    onSuccess: (created) => { setDialogOpen(false); setForm(blankPeriod); setSelectedId(created.id); setSearchParams({ period: created.id }); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) },
    onError: (mutationError) => setError((mutationError as Error).message),
  })
  const finalizeMutation = useMutation({
    mutationFn: () => finalizePayroll(selectedPeriod!.id, crypto.randomUUID()),
    onSuccess: () => { setConfirmAction(null); setError(''); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }); void queryClient.invalidateQueries({ queryKey: ['payroll-records'] }); void queryClient.invalidateQueries({ queryKey: ['payroll-preview'] }) },
    onError: (mutationError) => setError((mutationError as Error).message),
  })
  const paidMutation = useMutation({
    mutationFn: () => markPayrollPaid(selectedPeriod!.id),
    onSuccess: () => { setConfirmAction(null); setError(''); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) },
    onError: (mutationError) => setError((mutationError as Error).message),
  })
  const publishMutation = useMutation({
    mutationFn: () => publishPayslips(selectedPeriod!.id),
    onSuccess: () => { setConfirmAction(null); setError('Payslips published successfully.'); void queryClient.invalidateQueries({ queryKey: ['payroll-periods'] }) },
    onError: (mutationError) => setError((mutationError as Error).message),
  })

  const previewRecords = (preview.data ?? []) as PayrollRecord[]
  const displayedRecords = preview.isSuccess ? previewRecords : (records.data ?? [])
  const visibleRecords = displayedRecords.filter((record) => `${record.employee?.first_name ?? ''} ${record.employee?.last_name ?? ''} ${record.employee?.employee_number ?? ''} ${record.employee_id} ${record.salary_type}`.toLowerCase().includes(recordSearch.trim().toLowerCase()))
  const totals = useMemo(() => displayedRecords.reduce((result, record) => ({ gross: result.gross + Number(record.gross_pay || 0), deductions: result.deductions + Number(record.total_deductions || 0), net: result.net + Number(record.net_pay || 0) }), { gross: 0, deductions: 0, net: 0 }), [displayedRecords])
  const actionPending = finalizeMutation.isPending || paidMutation.isPending || publishMutation.isPending

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.name || !form.start_date || !form.end_date || !form.pay_date) { setError('All payroll period fields are required.'); return }
    if (form.end_date < form.start_date || form.pay_date < form.end_date) { setError('End date must follow start date, and pay date must be on or after the end date.'); return }
    createMutation.mutate()
  }

  function selectPeriod(id: string) {
    setSelectedId(id)
    setSearchParams({ period: id })
    queryClient.removeQueries({ queryKey: ['payroll-preview', id] })
    setError('')
  }

  function requestPreview() {
    if (!selectedPeriod) return
    queryClient.removeQueries({ queryKey: ['payroll-preview', selectedPeriod.id] })
    void preview.refetch()
  }

  function confirmActionNow() {
    if (!selectedPeriod || !confirmAction) return
    if (confirmAction === 'finalize') finalizeMutation.mutate()
    if (confirmAction === 'paid') paidMutation.mutate()
    if (confirmAction === 'publish') publishMutation.mutate()
  }

  const actionCopy = confirmAction === 'finalize' ? { title: 'Finalize payroll?', description: 'This creates immutable payroll records and loan repayment transactions.', button: 'Finalize payroll', variant: 'primary' as const } : confirmAction === 'paid' ? { title: 'Mark payroll as paid?', description: 'This records the pay cycle as paid. Confirm that the bank or cash disbursement is complete.', button: 'Mark as paid', variant: 'primary' as const } : { title: 'Publish payslips?', description: 'Employees will be notified that their payslips are available.', button: 'Publish payslips', variant: 'primary' as const }

  return <div>
    <PageHeading eyebrow="Pay cycle" title="Payroll processing" description="Move each period from preparation to review, finalization, payment, and payslip publication." />
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <Card className="h-fit xl:sticky xl:top-24">
        <CardHeader className="gap-4"><div className="flex items-start justify-between gap-3"><div><CardTitle>Pay periods</CardTitle><CardDescription>{periods.data?.length ?? 0} configured periods.</CardDescription></div><Button size="icon" onClick={() => { setError(''); setForm(blankPeriod); setDialogOpen(true) }} aria-label="Create payroll period"><Plus className="h-4 w-4" /></Button></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={periodSearch} onChange={(event) => setPeriodSearch(event.target.value)} placeholder="Search periods" className="pl-9" /><select aria-label="Filter period status" className="mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm" value={periodStatus} onChange={(event) => setPeriodStatus(event.target.value as typeof periodStatus)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="processing">Processing</option><option value="review">Review</option><option value="finalized">Finalized</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option></select></div></CardHeader>
        <CardContent>{periods.isLoading ? <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : visiblePeriods.length ? <div className="space-y-2">{visiblePeriods.map((period) => <button key={period.id} onClick={() => selectPeriod(period.id)} className={`w-full rounded-lg border p-4 text-left transition ${selectedPeriod?.id === period.id ? 'border-primary bg-primary/5 shadow-sm' : 'hover:bg-secondary/60'}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{period.name}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(period.start_date)} to {formatDate(period.end_date)}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></div><div className="mt-3 flex items-center justify-between gap-2"><Badge variant={period.status === 'finalized' || period.status === 'paid' ? 'success' : period.status === 'cancelled' ? 'danger' : 'warning'}>{period.status}</Badge><span className="text-[11px] text-muted-foreground">Pay {formatDate(period.pay_date)}</span></div></button>)}</div> : <EmptyState title={periods.data?.length ? 'No matching periods' : 'No payroll periods'} description={periods.data?.length ? 'Adjust your search.' : 'Create a period before collecting inputs.'} />}</CardContent>
      </Card>

      <div className="min-w-0 space-y-6">
        {error && <Alert variant={error === 'Payslips published successfully.' ? 'default' : 'danger'}>{error}</Alert>}
        {selectedPeriod ? <>
          <Card className="overflow-hidden">
            <CardHeader className="gap-5 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-3"><CardTitle className="text-xl sm:text-2xl">{selectedPeriod.name}</CardTitle><Badge variant={selectedPeriod.status === 'finalized' || selectedPeriod.status === 'paid' ? 'success' : selectedPeriod.status === 'cancelled' ? 'danger' : 'warning'}>{selectedPeriod.status}</Badge></div><CardDescription className="mt-2">{formatDate(selectedPeriod.start_date)} to {formatDate(selectedPeriod.end_date)} · Pay date {formatDate(selectedPeriod.pay_date)}</CardDescription></div><div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap"><Button variant="outline" size="sm" onClick={requestPreview} disabled={preview.isFetching || ['finalized', 'paid', 'cancelled'].includes(selectedPeriod.status)}><RefreshCw className={`h-4 w-4 ${preview.isFetching ? 'animate-spin' : ''}`} />Preview</Button>{!['finalized', 'paid', 'cancelled'].includes(selectedPeriod.status) && <Button size="sm" onClick={() => setConfirmAction('finalize')} disabled={actionPending || !preview.isSuccess}><FileCheck2 className="h-4 w-4" />Finalize</Button>}{selectedPeriod.status === 'finalized' && <Button size="sm" onClick={() => setConfirmAction('paid')} disabled={actionPending}><CheckCircle2 className="h-4 w-4" />Mark paid</Button>}{(selectedPeriod.status === 'finalized' || selectedPeriod.status === 'paid') && <Button size="sm" variant="outline" onClick={() => setConfirmAction('publish')} disabled={actionPending}><FileCheck2 className="h-4 w-4" />Publish payslips</Button>}</div></CardHeader>
            <CardContent><ProcessingSteps status={selectedPeriod.status} /></CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-3"><MoneySummary label="Gross pay" value={totals.gross} tone="default" /><MoneySummary label="Deductions" value={totals.deductions} tone="warning" /><MoneySummary label="Net pay" value={totals.net} tone="success" /></div>

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" />Payroll ledger</CardTitle><CardDescription>{displayedRecords.length} employee records {preview.isSuccess ? 'in the current server preview' : 'available for this period'}.</CardDescription></div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={recordSearch} onChange={(event) => setRecordSearch(event.target.value)} placeholder="Search employee" className="pl-9" /></div></CardHeader>
            <CardContent>
              {preview.isError && <Alert variant="warning" className="mb-4"><ShieldAlert className="mr-2 inline h-4 w-4" />{(preview.error as Error).message}. Complete missing policy, salary, attendance, or statutory inputs before finalization.</Alert>}
              {!preview.isSuccess && !preview.isFetching && !['finalized', 'paid', 'cancelled'].includes(selectedPeriod.status) && <Alert className="mb-4"><AlertTriangle className="mr-2 inline h-4 w-4 text-amber-600" />Run a server preview before finalizing this period. The preview validates every employee input.</Alert>}
              {records.isLoading || preview.isFetching ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : visibleRecords.length ? <><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Basic pay</TableHead><TableHead>Gross</TableHead><TableHead>Deductions</TableHead><TableHead className="text-right">Net pay</TableHead></TableRow></TableHeader><TableBody>{visibleRecords.map((record) => <TableRow key={record.id}><TableCell><div className="font-semibold">{record.employee ? `${record.employee.last_name}, ${record.employee.first_name}` : 'Employee'}</div><div className="text-xs text-muted-foreground">{record.employee?.employee_number ?? record.employee_id}</div></TableCell><TableCell className="money">{formatCurrency(record.basic_pay)}</TableCell><TableCell className="money">{formatCurrency(record.gross_pay)}</TableCell><TableCell className="money">{formatCurrency(record.total_deductions)}</TableCell><TableCell className="money text-right font-bold text-primary">{formatCurrency(record.net_pay)}</TableCell></TableRow>)}</TableBody></Table></div><div className="space-y-2 md:hidden">{visibleRecords.map((record) => <div key={record.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : 'Employee'}</div><div className="text-xs text-muted-foreground">{record.employee?.employee_number ?? record.employee_id}</div></div><div className="money text-right font-black text-primary">{formatCurrency(record.net_pay)}</div></div><div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-xs"><div><div className="text-muted-foreground">Basic</div><div className="money mt-1 font-semibold">{formatCurrency(record.basic_pay)}</div></div><div><div className="text-muted-foreground">Gross</div><div className="money mt-1 font-semibold">{formatCurrency(record.gross_pay)}</div></div><div><div className="text-muted-foreground">Deductions</div><div className="money mt-1 font-semibold">{formatCurrency(record.total_deductions)}</div></div></div></div>)}</div></> : <EmptyState title={displayedRecords.length && recordSearch.trim() ? 'No matching records' : preview.isSuccess ? 'No eligible employees' : 'No payroll records yet'} description={displayedRecords.length && recordSearch.trim() ? 'Adjust your search.' : preview.isSuccess ? 'Check active employees and effective salary records.' : 'Run a server-side preview after configuring payroll inputs.'} />}
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Control record</CardTitle><CardDescription>Finalization creates an immutable audit snapshot and loan repayment transaction.</CardDescription></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-3"><Control label="Inputs" value="Database records" /><Control label="Calculation" value="PostgreSQL function" /><Control label="Finalization" value="Atomic transaction" /></CardContent></Card>
        </> : <Card><CardContent className="py-16"><EmptyState title="Select a payroll period" description="Choose an existing period or create a new one to begin." /></CardContent></Card>}
      </div>
    </div>

    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Create payroll period" description="Periods cannot overlap another regular payroll period."><form onSubmit={submit} className="space-y-5">{error && <Alert variant="danger">{error}</Alert>}<div><Label htmlFor="period-name">Period name</Label><Input id="period-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="October 2026 - First Cutoff" required /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="period-frequency">Frequency</Label><select id="period-frequency" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.frequency} onChange={(event) => setForm((current) => ({ ...current, frequency: event.target.value as PeriodForm['frequency'] }))}><option value="monthly">Monthly</option><option value="semi_monthly">Semi-monthly</option><option value="special">Special payroll</option></select></div><div><Label htmlFor="period-pay-date">Pay date</Label><Input id="period-pay-date" type="date" value={form.pay_date} onChange={(event) => setForm((current) => ({ ...current, pay_date: event.target.value }))} required /></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="period-start-date">Start date</Label><Input id="period-start-date" type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} required /></div><div><Label htmlFor="period-end-date">End date</Label><Input id="period-end-date" type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} required /></div></div><div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create period'}</Button></div></form></Dialog>
    <Dialog open={Boolean(confirmAction)} onClose={() => { if (!actionPending) setConfirmAction(null) }} title={actionCopy.title} description={actionCopy.description}><div className="space-y-5"><div className="rounded-lg bg-secondary/60 p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{selectedPeriod?.name}</div><div className="money mt-2 text-2xl font-black">{formatCurrency(totals.net)}</div><div className="mt-1 text-sm text-muted-foreground">Estimated net payroll for {displayedRecords.length} employee records.</div></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={actionPending} onClick={() => setConfirmAction(null)}>Cancel</Button><Button type="button" variant={actionCopy.variant} disabled={actionPending} onClick={confirmActionNow}>{actionPending ? 'Processing...' : actionCopy.button}</Button></div></div></Dialog>
  </div>
}

function ProcessingSteps({ status }: { status: PayrollPeriod['status'] }) {
  const steps = ['Prepare', 'Review', 'Finalize', 'Paid']
  const active = status === 'paid' ? 3 : status === 'finalized' ? 2 : status === 'review' || status === 'processing' ? 1 : 0
  return <div className="grid grid-cols-4 gap-2">{steps.map((step, index) => <div key={step} className="min-w-0"><div className={`h-1.5 rounded-full ${index <= active ? 'bg-primary' : 'bg-secondary'}`} /><div className={`mt-2 truncate text-[10px] font-bold uppercase tracking-wide ${index <= active ? 'text-primary' : 'text-muted-foreground'}`}>{step}</div></div>)}</div>
}

function MoneySummary({ label, value, tone }: { label: string; value: number; tone: 'default' | 'warning' | 'success' }) {
  return <Card className="p-4"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className={`money mt-2 text-xl font-black ${tone === 'success' ? 'text-primary' : tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : ''}`}>{formatCurrency(value)}</div></Card>
}

function Control({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg border p-3"><CircleDollarSign className="h-4 w-4 text-primary" /><div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div></div>
}
