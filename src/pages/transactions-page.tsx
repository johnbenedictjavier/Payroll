import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Check, Plus, ReceiptText, Search, X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListPagination } from '@/components/ui/list-pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePagination } from '@/lib/use-pagination'
import { createOtherTransaction, listEmployees, listOtherTransactions, listPayrollPeriods, updateOtherTransactionStatus } from '@/services/api'
import { formatCurrency } from '@/lib/utils'
import type { OtherTransaction } from '@/types/database'

type TransactionKind = 'income' | 'deduction'
type TransactionForm = { payroll_period_id: string; employee_id: string; transaction_type: string; amount: string; description: string }
const blank: TransactionForm = { payroll_period_id: '', employee_id: '', transaction_type: '', amount: '', description: '' }

export function TransactionsPage() {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<TransactionKind>('income')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [approvalTarget, setApprovalTarget] = useState<{ transaction: OtherTransaction; status: 'approved' | 'rejected' } | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const employees = useQuery({ queryKey: ['employees'], queryFn: () => listEmployees() })
  const transactions = useQuery({ queryKey: ['transactions', kind], queryFn: () => listOtherTransactions(kind) })
  const data = (transactions.data ?? []) as OtherTransaction[]
  const visibleTransactions = useMemo(() => data.filter((transaction) => { const period = periods.data?.find((item) => item.id === transaction.payroll_period_id); const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter; return matchesStatus && `${transaction.employee?.first_name ?? ''} ${transaction.employee?.last_name ?? ''} ${transaction.employee?.employee_number ?? ''} ${period?.name ?? ''} ${transaction.transaction_type} ${transaction.description ?? ''} ${transaction.amount} ${transaction.status}`.toLowerCase().includes(search.trim().toLowerCase()) }), [data, periods.data, search, statusFilter])
  const pagination = usePagination(visibleTransactions, `${kind}|${search}|${statusFilter}`)
  const pending = data.filter((transaction) => transaction.status === 'pending')
  const approvedTotal = data.filter((transaction) => transaction.status === 'approved').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
  const pendingTotal = pending.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)

  const createMutation = useMutation({ mutationFn: () => createOtherTransaction(kind, { ...form, amount: Number(form.amount) }), onSuccess: () => { setOpen(false); setForm(blank); void queryClient.invalidateQueries({ queryKey: ['transactions', kind] }) }, onError: (errorValue) => setError((errorValue as Error).message) })
  const statusMutation = useMutation({ mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => updateOtherTransactionStatus(kind, id, status), onSuccess: () => { setApprovalTarget(null); void queryClient.invalidateQueries({ queryKey: ['transactions', kind] }) }, onError: (errorValue) => setError((errorValue as Error).message) })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!form.payroll_period_id || !form.employee_id || !form.transaction_type || Number(form.amount) <= 0) { setError('Period, employee, type, and a positive amount are required.'); return }
    createMutation.mutate()
  }

  function openCreate() {
    setError('')
    setForm({ ...blank, payroll_period_id: periods.data?.find((period) => period.status === 'draft')?.id ?? '' })
    setOpen(true)
  }

  const approvalIsPositive = approvalTarget?.status === 'approved'

  return <div>
    <PageHeading eyebrow="Payroll inputs" title="Income and deductions" description="Record one-off payroll transactions, then review them before they reach the final calculation." />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"><div className="grid grid-cols-2 rounded-lg border bg-card p-1 shadow-sm"><button type="button" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${kind === 'income' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`} onClick={() => setKind('income')}><ArrowUpCircle className="h-4 w-4" />Income</button><button type="button" className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition ${kind === 'deduction' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`} onClick={() => setKind('deduction')}><ArrowDownCircle className="h-4 w-4" />Deductions</button></div><Button className="sm:ml-auto" onClick={openCreate}><Plus className="h-4 w-4" />Add transaction</Button></div>
    {error && <Alert variant="danger" className="mb-6">{error}</Alert>}
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><TransactionMetric label="Approved total" value={formatCurrency(approvedTotal)} detail="Included in payroll preview" tone="success" /><TransactionMetric label="Pending review" value={pending.length} detail={formatCurrency(pendingTotal)} tone="warning" /><TransactionMetric label="Visible records" value={visibleTransactions.length} detail={kind === 'income' ? 'Other income' : 'Other deductions'} tone="default" /></div>
    <Card><CardHeader className="gap-4"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-primary" />{kind === 'income' ? 'Additional income' : 'Authorized deductions'}</CardTitle><CardDescription>Transactions are approved by an administrator before payroll calculation.</CardDescription></div><span className="section-kicker text-muted-foreground">Review ledger</span></div><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employee, period, or transaction" className="pl-9" /></div><select aria-label="Filter transaction status" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div></CardHeader><CardContent>{transactions.isLoading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : visibleTransactions.length ? <><div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Period</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{pagination.pageItems.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} periodName={periods.data?.find((period) => period.id === transaction.payroll_period_id)?.name} onAction={(status) => setApprovalTarget({ transaction, status })} />)}</TableBody></Table></div><div className="space-y-3 md:hidden">{pagination.pageItems.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} periodName={periods.data?.find((period) => period.id === transaction.payroll_period_id)?.name} onAction={(status) => setApprovalTarget({ transaction, status })} />)}</div><ListPagination total={visibleTransactions.length} start={pagination.startIndex} end={pagination.endIndex} page={pagination.page} pageCount={pagination.pageCount} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /></> : <EmptyState title="No matching transactions" description="Add a transaction or adjust the current filters." />}</CardContent></Card>

    <Dialog open={open} onClose={() => { if (!createMutation.isPending) setOpen(false) }} title={`Add ${kind === 'income' ? 'other income' : 'other deduction'}`} description="New transactions start as pending and must be approved before payroll calculation."><form onSubmit={submit} className="space-y-5">{error && <Alert variant="danger">{error}</Alert>}<div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="transaction-period">Payroll period</Label><select id="transaction-period" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.payroll_period_id} onChange={(event) => setForm((current) => ({ ...current, payroll_period_id: event.target.value }))}><option value="">Select period</option>{periods.data?.filter((period) => !['finalized', 'paid', 'cancelled'].includes(period.status)).map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></div><div><Label htmlFor="transaction-employee">Employee</Label><select id="transaction-employee" className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.employee_id} onChange={(event) => setForm((current) => ({ ...current, employee_id: event.target.value }))}><option value="">Select employee</option>{employees.data?.filter((employee) => employee.status === 'active').map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} - {employee.last_name}, {employee.first_name}</option>)}</select></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="transaction-type">Transaction type</Label><Input id="transaction-type" value={form.transaction_type} onChange={(event) => setForm((current) => ({ ...current, transaction_type: event.target.value }))} placeholder={kind === 'income' ? 'Bonus or allowance' : 'Authorized deduction'} required /></div><div><Label htmlFor="transaction-amount">Amount</Label><Input id="transaction-amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} required /></div></div><div><Label htmlFor="transaction-description">Description</Label><Input id="transaction-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Reason or supporting note" /></div><div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={createMutation.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" loading={createMutation.isPending} loadingLabel="Adding...">Add transaction</Button></div></form></Dialog>
    <ConfirmationDialog open={Boolean(approvalTarget)} onClose={() => setApprovalTarget(null)} onConfirm={() => { if (approvalTarget) statusMutation.mutate({ id: approvalTarget.transaction.id, status: approvalTarget.status }) }} title={approvalIsPositive ? 'Approve transaction?' : 'Reject transaction?'} description={approvalIsPositive ? 'Approved transactions can be included in the payroll preview.' : 'Rejected transactions will stay in the audit history and will not affect payroll.'} confirmLabel={approvalIsPositive ? 'Approve transaction' : 'Reject transaction'} variant={approvalIsPositive ? 'primary' : 'danger'} loading={statusMutation.isPending}><div className="rounded-lg bg-secondary/60 p-4"><div className="font-semibold">{approvalTarget?.transaction.employee ? `${approvalTarget.transaction.employee.first_name} ${approvalTarget.transaction.employee.last_name}` : 'Employee'}</div><div className="money mt-1 text-xl font-black">{formatCurrency(approvalTarget?.transaction.amount)}</div><div className="mt-1 text-xs text-muted-foreground">{approvalTarget?.transaction.transaction_type}</div></div></ConfirmationDialog>
  </div>
}

function TransactionRow({ transaction, periodName, onAction }: { transaction: OtherTransaction; periodName?: string; onAction: (status: 'approved' | 'rejected') => void }) {
  return <TableRow className="data-row-in"><TableCell><div className="font-semibold">{transaction.employee ? `${transaction.employee.last_name}, ${transaction.employee.first_name}` : 'Employee'}</div><div className="text-xs text-muted-foreground">{transaction.employee?.employee_number}</div></TableCell><TableCell>{periodName ?? 'Period'}</TableCell><TableCell><div>{transaction.transaction_type}</div><div className="max-w-48 truncate text-xs text-muted-foreground">{transaction.description || 'No description'}</div></TableCell><TableCell className="money font-semibold">{formatCurrency(transaction.amount)}</TableCell><TableCell><StatusBadge status={transaction.status} /></TableCell><TableCell className="text-right">{transaction.status === 'pending' && <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => onAction('rejected')}><X className="h-4 w-4" />Reject</Button><Button size="sm" onClick={() => onAction('approved')}><Check className="h-4 w-4" />Approve</Button></div>}</TableCell></TableRow>
}

function TransactionCard({ transaction, periodName, onAction }: { transaction: OtherTransaction; periodName?: string; onAction: (status: 'approved' | 'rejected') => void }) {
  return <div className="data-row-in rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold">{transaction.employee ? `${transaction.employee.first_name} ${transaction.employee.last_name}` : 'Employee'}</div><div className="text-xs text-muted-foreground">{transaction.employee?.employee_number} · {periodName ?? 'Period'}</div></div><StatusBadge status={transaction.status} /></div><div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-xs text-muted-foreground">{transaction.transaction_type}</div><div className="mt-1 text-sm">{transaction.description || 'No description'}</div></div><div className="money text-lg font-black">{formatCurrency(transaction.amount)}</div></div>{transaction.status === 'pending' && <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3"><Button size="sm" variant="outline" onClick={() => onAction('rejected')}><X className="h-4 w-4" />Reject</Button><Button size="sm" onClick={() => onAction('approved')}><Check className="h-4 w-4" />Approve</Button></div>}</div>
}

function StatusBadge({ status }: { status: OtherTransaction['status'] }) { return <Badge variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'}>{status}</Badge> }
function TransactionMetric({ label, value, detail, tone }: { label: string; value: string | number; detail: string; tone: 'default' | 'warning' | 'success' }) { return <Card className="p-4"><div className={`money text-xl font-black ${tone === 'success' ? 'text-primary' : tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : ''}`}>{value}</div><div className="mt-1 text-xs font-semibold">{label}</div><div className="text-[11px] text-muted-foreground">{detail}</div></Card> }
