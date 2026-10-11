import { useState } from 'react'
import { Download, FileText, LockKeyhole, Send } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { PageHeading } from '@/components/layout/page-heading'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { completePasswordChange, createProfileChangeRequest, getPayslipUrl, listAttendance, listPayrollPeriods, listPayrollRecords, listPayslips } from '@/services/api'
import { formatCurrency, formatDate } from '@/lib/utils'
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
import { validatePasswordChange, type PasswordErrors, type PasswordField } from '@/lib/password'

export function EmployeeAttendancePage() {
  const attendance = useQuery({ queryKey: ['my-attendance'], queryFn: () => listAttendance() })
  const periods = useQuery({ queryKey: ['my-periods'], queryFn: listPayrollPeriods })
  return <div><PageHeading eyebrow="Employee portal" title="My attendance" description="Review the attendance records associated with your payroll periods." /><Card><CardHeader><CardTitle>Attendance history</CardTitle><CardDescription>Only records linked to your employee account are visible.</CardDescription></CardHeader><CardContent>{attendance.isLoading ? <div className="space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : attendance.data?.length ? <Table><TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Days worked</TableHead><TableHead>Absences</TableHead><TableHead>Tardiness</TableHead><TableHead>Overtime</TableHead></TableRow></TableHeader><TableBody>{attendance.data.map((record) => { const period = periods.data?.find((item) => item.id === record.payroll_period_id); return <TableRow key={record.id}><TableCell><div className="font-semibold">{period?.name ?? 'Payroll period'}</div><div className="text-xs text-muted-foreground">{period ? `${formatDate(period.start_date)} - ${formatDate(period.end_date)}` : ''}</div></TableCell><TableCell>{record.days_worked}</TableCell><TableCell>{record.absence_days}</TableCell><TableCell>{record.tardiness_minutes} min</TableCell><TableCell>{record.overtime_hours} hrs</TableCell></TableRow> })}</TableBody></Table> : <EmptyState title="No attendance records" description="Attendance will appear once your administrator records it for a payroll period." />}</CardContent></Card></div>
}

export function EmployeePayrollPage() {
  const payroll = useQuery({ queryKey: ['my-payroll'], queryFn: () => listPayrollRecords() })
  const periods = useQuery({ queryKey: ['my-periods'], queryFn: listPayrollPeriods })
  return <div><PageHeading eyebrow="Employee portal" title="My payroll" description="View finalized payroll calculations and their component totals." /><Card><CardHeader><CardTitle>Payroll history</CardTitle><CardDescription>Draft and processing records remain hidden until published.</CardDescription></CardHeader><CardContent>{payroll.isLoading ? <Skeleton className="h-20" /> : payroll.data?.length ? <div className="space-y-3">{payroll.data.map((record) => { const period = periods.data?.find((item) => item.id === record.payroll_period_id); return <div key={record.id} className="rounded-xl border p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{period?.name ?? 'Payroll record'}</div><div className="mt-1 text-xs text-muted-foreground">{period ? `${formatDate(period.start_date)} - ${formatDate(period.end_date)} · Pay date ${formatDate(period.pay_date)}` : ''}</div></div><div className="text-left sm:text-right"><div className="text-xs uppercase tracking-wide text-muted-foreground">Net pay</div><div className="text-xl font-black text-primary">{formatCurrency(record.net_pay)}</div></div></div><div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-4"><Line label="Basic pay" value={formatCurrency(record.basic_pay)} /><Line label="Other income" value={formatCurrency(record.other_income)} /><Line label="Deductions" value={formatCurrency(record.total_deductions)} /><Line label="Gross pay" value={formatCurrency(record.gross_pay)} /></div></div> })}</div> : <EmptyState title="No payroll history" description="Published payroll calculations will appear here." />}</CardContent></Card></div>
}

export function EmployeePayslipsPage() {
  const payslips = useQuery({ queryKey: ['my-payslips'], queryFn: listPayslips })
  const [error, setError] = useState('')
  const [loadingId, setLoadingId] = useState('')
  async function download(id: string) { setError(''); setLoadingId(id); try { const url = await getPayslipUrl(id); window.open(url, '_blank', 'noopener,noreferrer') } catch (downloadError) { setError(downloadError instanceof Error ? downloadError.message : 'Unable to download payslip.') } finally { setLoadingId('') } }
  return <div><PageHeading eyebrow="Employee portal" title="My payslips" description="Download published payslips through an authenticated, short-lived link." />{error && <Alert variant="danger" className="mb-6">{error}</Alert>}<Card><CardHeader><CardTitle>Published payslips</CardTitle><CardDescription>Payslips remain private to your employee account.</CardDescription></CardHeader><CardContent>{payslips.isLoading ? <Skeleton className="h-20" /> : payslips.data?.length ? <div className="space-y-3">{payslips.data.map((payslip) => <div key={payslip.id} className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><FileText className="h-5 w-5" /></div><div><div className="font-semibold">{payslip.payroll_period?.name ?? 'Payslip'}</div><div className="text-xs text-muted-foreground">Published {payslip.published_at ? formatDate(payslip.published_at.slice(0, 10)) : 'Not published'}</div></div></div><Button variant="outline" onClick={() => download(payslip.id)} disabled={loadingId === payslip.id}><Download className="h-4 w-4" />{loadingId === payslip.id ? 'Preparing...' : 'View PDF'}</Button></div>)}</div> : <EmptyState title="No payslips published" description="Your administrator will publish a payslip after payroll finalization." />}</CardContent></Card></div>
}

export function EmployeeProfilePage() {
  const { employee } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [fields, setFields] = useState({ email: employee?.email ?? '', contact_number: employee?.contact_number ?? '', permanent_address: employee?.permanent_address ?? '', present_address: employee?.present_address ?? '', religion: employee?.religion ?? '', civil_status: employee?.civil_status ?? '' })
  const [message, setMessage] = useState('')
  const mutation = useMutation({ mutationFn: () => createProfileChangeRequest(employee!.id, fields, reason), onSuccess: () => { setDialogOpen(false); setMessage('Your profile change request was submitted for administrator review.') }, onError: (error) => setMessage((error as Error).message) })
  if (!employee) return <EmptyState title="Employee profile unavailable" description="Your account is not linked to an employee record. Contact an administrator." />
  return <div><PageHeading eyebrow="Employee portal" title="My profile" description="Official employment details are read-only. Submit a request when personal information needs correction." />{message && <Alert className="mb-6" variant={message.includes('submitted') ? 'default' : 'danger'}>{message}</Alert>}<div className="grid gap-6 xl:grid-cols-[0.65fr_0.35fr]"><Card><CardHeader><CardTitle>Personal and employment information</CardTitle><CardDescription>Changes are reviewed before they update the official record.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-black text-primary">{employee.first_name[0]}{employee.last_name[0]}</div><div><div className="text-xl font-black">{employee.first_name} {employee.middle_name ? `${employee.middle_name} ` : ''}{employee.last_name}</div><div className="mt-1 text-sm text-muted-foreground">{employee.employee_number} - {employee.position?.name ?? 'Position not assigned'}</div><Badge className="mt-3" variant={employee.status === 'active' ? 'success' : 'muted'}>{employee.status}</Badge></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2"><ReadOnly label="Email" value={employee.email} /><ReadOnly label="Contact number" value={employee.contact_number} /><ReadOnly label="Department" value={employee.department?.name} /><ReadOnly label="Position" value={employee.position?.name} /><ReadOnly label="Civil status" value={employee.civil_status} /><ReadOnly label="Birth date" value={employee.birth_date ? formatDate(employee.birth_date) : null} /><ReadOnly label="Permanent address" value={employee.permanent_address} /><ReadOnly label="Present address" value={employee.present_address} /></div><Button className="mt-7" onClick={() => { setFields({ email: employee.email ?? '', contact_number: employee.contact_number ?? '', permanent_address: employee.permanent_address ?? '', present_address: employee.present_address ?? '', religion: employee.religion ?? '', civil_status: employee.civil_status ?? '' }); setReason(''); setMessage(''); setDialogOpen(true) }}><Send className="h-4 w-4" />Request a change</Button></CardContent></Card><Card className="h-fit"><CardHeader><CardTitle>Account security</CardTitle><CardDescription>Password changes are managed by the PMS account service.</CardDescription></CardHeader><CardContent><div className="rounded-xl bg-secondary/60 p-4"><LockKeyhole className="h-5 w-5 text-primary" /><p className="mt-3 text-sm text-muted-foreground">Use the account settings page to change your password. Salary, attendance, loans, and finalized payroll cannot be changed from this portal.</p></div></CardContent></Card></div><Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Request profile change" description="An administrator will review these non-financial changes."><form className="space-y-5" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><div className="grid gap-4 sm:grid-cols-2">{Object.entries(fields).map(([key, value]) => <div key={key}><Label>{key.replaceAll('_', ' ')}</Label><Input value={value} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div><div><Label>Reason</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what needs to be corrected" /></div><div className="flex justify-end gap-2 border-t pt-5"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={mutation.isPending}><Send className="h-4 w-4" />Submit request</Button></div></form></Dialog></div>
}

export function SettingsPage() {
  const { employee, refreshIdentity } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [busy, setBusy] = useState(false)
  const [completionPending, setCompletionPending] = useState(false)
  function clearError(field: PasswordField) { setErrors((current) => ({ ...current, [field]: undefined })); setMessage('') }
  async function finishFirstLogin() {
    setBusy(true)
    try { await completePasswordChange(); await refreshIdentity(); setCompletionPending(false); navigate('/employee', { replace: true, state: { passwordChanged: true } }) } catch (error) { setMessage(error instanceof Error ? error.message : 'Your account setup could not be completed.') } finally { setBusy(false) }
  }
  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')
    if (completionPending) { await finishFirstLogin(); return }
    const validationErrors = validatePasswordChange(password, confirmation)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setErrors({ password: error.message }); setMessage(error.message); return }
      if (employee?.must_change_password) {
        try { await completePasswordChange() } catch { setCompletionPending(true); throw new Error('Password updated, but account setup still needs confirmation. Submit again to finish setup.') }
      }
      await refreshIdentity()
      setPassword('')
      setConfirmation('')
      navigate('/employee', { replace: true, state: { passwordChanged: true } })
    } catch (completionError) { setMessage(completionError instanceof Error ? completionError.message : 'The password was updated, but the account could not be confirmed.') } finally { setBusy(false) }
  }
  return <div><PageHeading eyebrow="Account" title="Settings" description="Manage your authenticated account. Official payroll data remains protected by administrator workflows." />{employee?.must_change_password && <Alert className="mb-6" variant="warning">Your temporary password must be changed before you can access the employee portal.</Alert>}<Card className="max-w-xl"><CardHeader><CardTitle>Change password</CardTitle><CardDescription>Use a unique password that is not reused elsewhere.</CardDescription></CardHeader><CardContent><form noValidate onSubmit={changePassword} className="space-y-5">{message && <Alert variant="danger">{message}</Alert>}<div><Label htmlFor="employee-new-password">New password</Label><Input id="employee-new-password" type="password" minLength={8} value={password} onFocus={() => clearError('password')} onChange={(event) => { clearError('password'); setPassword(event.target.value) }} required aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'employee-new-password-error' : undefined} className={errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : undefined} />{errors.password && <p id="employee-new-password-error" className="mt-1 text-xs font-medium text-red-600">{errors.password}</p>}</div><div><Label htmlFor="employee-confirm-password">Confirm new password</Label><Input id="employee-confirm-password" type="password" minLength={8} value={confirmation} onFocus={() => clearError('confirmation')} onChange={(event) => { clearError('confirmation'); setConfirmation(event.target.value) }} required aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation ? 'employee-confirm-password-error' : undefined} className={errors.confirmation ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15' : undefined} />{errors.confirmation && <p id="employee-confirm-password-error" className="mt-1 text-xs font-medium text-red-600">{errors.confirmation}</p>}</div><Button type="submit" disabled={busy}><LockKeyhole className="h-4 w-4" />{busy ? 'Updating...' : completionPending ? 'Finish account setup' : 'Update password'}</Button></form></CardContent></Card></div>
}

function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) { return <div><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || 'Not set'}</div></div> }
function Line({ label, value }: { label: string; value: string }) { return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div> }
