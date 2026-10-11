import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2, Save, Search } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { listAttendance, listEmployees, listPayrollPeriods, saveAttendance } from '@/services/api'
import type { Attendance } from '@/types/database'

type AttendanceDraft = Pick<Attendance, 'payroll_period_id' | 'employee_id' | 'days_worked' | 'absence_days' | 'tardiness_minutes' | 'undertime_minutes' | 'overtime_hours' | 'notes'>
const blankDraft = (periodId: string, employeeId: string): AttendanceDraft => ({ payroll_period_id: periodId, employee_id: employeeId, days_worked: 0, absence_days: 0, tardiness_minutes: 0, undertime_minutes: 0, overtime_hours: 0, notes: '' })

export function AttendancePage() {
  const queryClient = useQueryClient()
  const periods = useQuery({ queryKey: ['payroll-periods'], queryFn: listPayrollPeriods })
  const employees = useQuery({ queryKey: ['employees'], queryFn: () => listEmployees() })
  const [periodId, setPeriodId] = useState('')
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>({})
  const [message, setMessage] = useState('')
  const attendance = useQuery({ queryKey: ['attendance', periodId], queryFn: () => listAttendance(periodId), enabled: Boolean(periodId) })
  const saveMutation = useMutation({ mutationFn: (draft: AttendanceDraft) => saveAttendance(draft), onSuccess: () => { setMessage('Attendance saved.'); void queryClient.invalidateQueries({ queryKey: ['attendance', periodId] }) }, onError: (error) => setMessage((error as Error).message) })
  const activeEmployees = useMemo(() => employees.data?.filter((employee) => employee.status === 'active' && `${employee.first_name} ${employee.last_name} ${employee.employee_number}`.toLowerCase().includes(search.toLowerCase())) ?? [], [employees.data, search])

  useEffect(() => { if (!periodId && periods.data?.[0]) setPeriodId(periods.data[0].id) }, [periodId, periods.data])
  useEffect(() => { if (!periodId) return; const existing = Object.fromEntries((attendance.data ?? []).map((row) => [row.employee_id, { payroll_period_id: row.payroll_period_id, employee_id: row.employee_id, days_worked: row.days_worked, absence_days: row.absence_days, tardiness_minutes: row.tardiness_minutes, undertime_minutes: row.undertime_minutes, overtime_hours: row.overtime_hours, notes: row.notes ?? '' }])); setDrafts(existing) }, [attendance.data, periodId])

  function draftFor(employeeId: string) { return drafts[employeeId] ?? blankDraft(periodId, employeeId) }
  function update(employeeId: string, field: keyof Omit<AttendanceDraft, 'payroll_period_id' | 'employee_id'>, value: string) { const current = draftFor(employeeId); setDrafts((all) => ({ ...all, [employeeId]: { ...current, [field]: field === 'notes' ? value : Math.max(0, Number(value) || 0) } })) }

  return <div><PageHeading eyebrow="Payroll inputs" title="Attendance" description="Record attendance against a specific period. Corrections are available before payroll finalization." /><div className="mb-6 grid gap-4 sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"><div><Label>Payroll period</Label><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">Select a period</option>{periods.data?.map((period) => <option key={period.id} value={period.id}>{period.name} ({period.status})</option>)}</select></div><div className="relative self-end"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter employees" /></div></div>{message && <Alert className="mb-6" variant={message.includes('saved') ? 'default' : 'danger'}>{message}</Alert>}{!periodId ? <EmptyState title="Choose a payroll period" description="Attendance belongs to exactly one payroll period." /> : <Card><CardHeader><div className="flex items-start justify-between"><div><CardTitle className="flex items-center gap-2"><CalendarCheck2 className="h-5 w-5 text-primary" />Attendance register</CardTitle><CardDescription>{activeEmployees.length} active employees shown. Units are days, minutes, and hours.</CardDescription></div><Badge variant="warning">Draft inputs</Badge></div></CardHeader><CardContent>{employees.isLoading || attendance.isLoading ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : activeEmployees.length === 0 ? <EmptyState title="No active employees found" description="Add or activate employees before entering attendance." /> : <div className="space-y-4">{activeEmployees.map((employee) => { const draft = draftFor(employee.id); return <div key={employee.id} className="rounded-2xl border p-4"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">{employee.last_name}, {employee.first_name}</div><div className="text-xs text-muted-foreground">{employee.employee_number} · {employee.position?.name ?? 'Unassigned'}</div></div><Button size="sm" onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}><Save className="h-4 w-4" />Save record</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><NumericField label="Days worked" value={draft.days_worked} onChange={(value) => update(employee.id, 'days_worked', value)} /><NumericField label="Absence days" value={draft.absence_days} onChange={(value) => update(employee.id, 'absence_days', value)} /><NumericField label="Tardiness minutes" value={draft.tardiness_minutes} onChange={(value) => update(employee.id, 'tardiness_minutes', value)} /><NumericField label="Undertime minutes" value={draft.undertime_minutes} onChange={(value) => update(employee.id, 'undertime_minutes', value)} /><NumericField label="Overtime hours" value={draft.overtime_hours} onChange={(value) => update(employee.id, 'overtime_hours', value)} /></div><div className="mt-3"><Label>Notes</Label><Input value={draft.notes ?? ''} onChange={(event) => update(employee.id, 'notes', event.target.value)} placeholder="Optional correction note" /></div></div>})}</div>}</CardContent></Card>}</div>
}

function NumericField({ label, value, onChange }: { label: string; value: number; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} /></div> }
