import { useEffect, useState } from 'react'
import { Check, FileText, MailWarning, MoreHorizontal, Plus, Search, UserPlus, UserRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getEmployeePhotoUrl, listEmployees, listProfileChangeRequests, provisionEmployeeAccount, reviewProfileChangeRequest, updateEmployeeStatus } from '@/services/api'
import type { Employee } from '@/types/database'
import { formatDate } from '@/lib/utils'

export function EmployeesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const employees = useQuery({ queryKey: ['employees', search], queryFn: () => listEmployees(search) })
  const requests = useQuery({ queryKey: ['profile-change-requests'], queryFn: () => listProfileChangeRequests('pending') })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Employee['status'] }) => updateEmployeeStatus(id, status),
    onSuccess: () => { setOpenMenu(null); void queryClient.invalidateQueries({ queryKey: ['employees'] }) },
    onError: (error) => setMessage((error as Error).message),
  })
  const provisionMutation = useMutation({
    mutationFn: ({ id, email }: { id: string; email: string }) => provisionEmployeeAccount(id, email),
    onSuccess: () => { setOpenMenu(null); setMessage('Portal account created. The temporary password is PMS@2026 and must be changed on first login.'); void queryClient.invalidateQueries({ queryKey: ['employees'] }) },
    onError: (error) => setMessage((error as Error).message),
  })
  const requestMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => reviewProfileChangeRequest(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['profile-change-requests'] }),
    onError: (error) => setMessage((error as Error).message),
  })

  return <div>
    <PageHeading eyebrow="People operations" title="Employees" description="Build complete employee profiles, retain submitted forms, and manage portal access without losing history." action={{ label: 'Add employee', to: '/admin/employees/new' }} />
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, employee number, or email" className="pl-10" /></div>
      <Link to="/admin/employees/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"><Plus className="h-4 w-4" />New full profile</Link>
    </div>
    {message && <Alert variant="default" className="mb-6">{message}</Alert>}
    <Card>
       <CardHeader><CardTitle>Employee directory</CardTitle><CardDescription>{employees.data?.length ?? 0} records available. Open a profile to manage every employee section.</CardDescription></CardHeader>
      <CardContent className="p-0 sm:p-2">
        {employees.isError && <Alert variant="danger" className="m-4">{(employees.error as Error).message}</Alert>}
        {employees.isLoading ? <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : employees.data?.length ? <>
          <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Assignment</TableHead><TableHead>Contact</TableHead><TableHead>Portal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{employees.data.map((employee) => <EmployeeRow key={employee.id} employee={employee} openMenu={openMenu === employee.id} onMenu={() => setOpenMenu(openMenu === employee.id ? null : employee.id)} onProvision={() => employee.email && provisionMutation.mutate({ id: employee.id, email: employee.email })} onToggle={() => statusMutation.mutate({ id: employee.id, status: employee.status === 'active' ? 'inactive' : 'active' })} busy={statusMutation.isPending || provisionMutation.isPending} />)}</TableBody></Table></div>
          <div className="space-y-3 p-3 md:hidden">{employees.data.map((employee) => <EmployeeCard key={employee.id} employee={employee} openMenu={openMenu === employee.id} onMenu={() => setOpenMenu(openMenu === employee.id ? null : employee.id)} onProvision={() => employee.email && provisionMutation.mutate({ id: employee.id, email: employee.email })} onToggle={() => statusMutation.mutate({ id: employee.id, status: employee.status === 'active' ? 'inactive' : 'active' })} busy={statusMutation.isPending || provisionMutation.isPending} />)}</div>
        </> : <div className="p-5"><EmptyState title="No employees found" description="Adjust your search or create the first complete employee profile." action={<Link to="/admin/employees/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground"><UserPlus className="h-4 w-4" />Add employee</Link>} /></div>}
      </CardContent>
    </Card>
    <Card className="mt-6"><CardHeader><CardTitle>Profile change requests</CardTitle><CardDescription>Employee-submitted personal information changes waiting for review.</CardDescription></CardHeader><CardContent>{requests.isLoading ? <Skeleton className="h-16" /> : requests.data?.length ? <div className="space-y-3">{requests.data.map((request) => <div key={request.id} className="flex flex-col gap-4 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="font-semibold">{request.employee ? `${request.employee.first_name} ${request.employee.last_name}` : 'Employee request'}</div><div className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(request.created_at.slice(0, 10))} · {Object.keys(request.requested_changes).join(', ') || 'Profile information'}</div><p className="mt-2 text-sm text-muted-foreground">{request.reason || 'No reason provided.'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={requestMutation.isPending} onClick={() => requestMutation.mutate({ id: request.id, status: 'rejected' })}><X className="h-4 w-4" />Reject</Button><Button size="sm" disabled={requestMutation.isPending} onClick={() => requestMutation.mutate({ id: request.id, status: 'approved' })}><Check className="h-4 w-4" />Approve</Button></div></div>)}</div> : <EmptyState title="No pending requests" description="Approved and rejected requests remain in the audit history." />}</CardContent></Card>
  </div>
}

function EmployeeRow({ employee, openMenu, onMenu, onProvision, onToggle, busy }: { employee: Employee; openMenu: boolean; onMenu: () => void; onProvision: () => void; onToggle: () => void; busy: boolean }) {
  return <TableRow><TableCell><Link to={`/admin/employees/${employee.id}`} className="flex items-center gap-3"><Avatar employee={employee} /><div><div className="font-semibold hover:text-primary">{employee.last_name}, {employee.first_name}</div><div className="text-xs text-muted-foreground">{employee.employee_number}</div></div></Link></TableCell><TableCell><div className="font-medium">{employee.position?.name ?? 'Unassigned'}</div><div className="text-xs text-muted-foreground">{employee.department?.name ?? 'No department'}</div></TableCell><TableCell><div className="max-w-44 truncate">{employee.email ?? 'No email'}</div><div className="text-xs text-muted-foreground">{employee.contact_number ?? 'No phone'}</div></TableCell><TableCell><Badge variant={employee.auth_user_id ? 'success' : 'warning'}>{employee.auth_user_id ? 'Ready' : 'Not provisioned'}</Badge></TableCell><TableCell><Badge variant={employee.status === 'active' ? 'success' : employee.status === 'inactive' ? 'muted' : 'warning'}>{employee.status}</Badge></TableCell><TableCell className="text-right"><EmployeeMenu employee={employee} open={openMenu} onToggle={onMenu} onProvision={onProvision} onStatus={onToggle} busy={busy} /></TableCell></TableRow>
}

function EmployeeCard({ employee, openMenu, onMenu, onProvision, onToggle, busy }: { employee: Employee; openMenu: boolean; onMenu: () => void; onProvision: () => void; onToggle: () => void; busy: boolean }) {
  return <div className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><Link to={`/admin/employees/${employee.id}`} className="flex items-center gap-3"><Avatar employee={employee} /><div><div className="font-semibold">{employee.first_name} {employee.last_name}</div><div className="text-xs text-muted-foreground">{employee.employee_number}</div></div></Link><EmployeeMenu employee={employee} open={openMenu} onToggle={onMenu} onProvision={onProvision} onStatus={onToggle} busy={busy} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Position</div><div className="font-medium">{employee.position?.name ?? 'Unassigned'}</div></div><div><div className="text-xs text-muted-foreground">Status</div><Badge variant={employee.status === 'active' ? 'success' : 'muted'}>{employee.status}</Badge></div></div><div className="mt-4 flex items-center justify-between border-t pt-3"><span className="flex max-w-[70%] items-center gap-1 truncate text-xs text-muted-foreground">{employee.email ? <MailWarning className="h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <MailWarning className="h-3.5 w-3.5 shrink-0 text-amber-600" />}{employee.email ?? 'Email required for portal'}</span><Badge variant={employee.auth_user_id ? 'success' : 'warning'}>{employee.auth_user_id ? 'Portal ready' : 'Setup needed'}</Badge></div></div>
}

function EmployeeMenu({ employee, open, onToggle, onProvision, onStatus, busy }: { employee: Employee; open: boolean; onToggle: () => void; onProvision: () => void; onStatus: () => void; busy: boolean }) {
  return <div className="relative inline-block text-left"><Button variant="ghost" size="icon" onClick={onToggle} aria-label={`Actions for ${employee.first_name} ${employee.last_name}`}><MoreHorizontal className="h-4 w-4" /></Button>{open && <div className="absolute right-0 top-10 z-30 w-52 rounded-xl border bg-card p-1 text-left shadow-xl"><Link to={`/admin/employees/${employee.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"><UserRound className="h-4 w-4" />Open full profile</Link>{employee.email && !employee.auth_user_id && <button disabled={busy} onClick={onProvision} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><UserPlus className="h-4 w-4" />Create portal account</button>}<button disabled={busy} onClick={onStatus} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><FileText className="h-4 w-4" />{employee.status === 'active' ? 'Deactivate employee' : 'Activate employee'}</button></div>}</div>
}

function Avatar({ employee }: { employee: Employee }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!employee.photo_path) {
      setPhotoUrl(null)
    } else if (employee.photo_path.startsWith('http')) {
      setPhotoUrl(employee.photo_path)
    } else {
      void getEmployeePhotoUrl(employee.photo_path).then((url) => { if (active) setPhotoUrl(url) }).catch(() => { if (active) setPhotoUrl(null) })
    }
    return () => { active = false }
  }, [employee.photo_path])

  return <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">{photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : `${employee.first_name[0] ?? ''}${employee.last_name[0] ?? ''}`}</div>
}
