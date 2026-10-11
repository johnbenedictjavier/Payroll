import { useState, type ChangeEvent } from 'react'
import { ImagePlus, Send } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeading } from '@/components/layout/page-heading'
import { EmployeeAvatar } from '@/components/profile/employee-avatar'
import { useAuth } from '@/contexts/auth-context'
import { formatDate } from '@/lib/utils'
import { createProfileChangeRequest, uploadOwnEmployeePhoto } from '@/services/api'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function EmployeeAccountPage() {
  const { employee, refreshIdentity } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const [fields, setFields] = useState({ email: '', contact_number: '', permanent_address: '', present_address: '', religion: '', civil_status: '' })
  const requestMutation = useMutation({
    mutationFn: () => createProfileChangeRequest(employee!.id, fields, reason),
    onSuccess: () => { setDialogOpen(false); setMessage('Your profile change request was submitted for administrator review.') },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'The profile change request could not be submitted.'),
  })

  if (!employee) return <EmptyState title="Employee profile unavailable" description="Your account is not linked to an employee record. Contact an administrator." />

  const currentEmployee = employee
  const displayName = `${employee.first_name} ${employee.last_name}`.trim()

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setPhotoError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPhotoError('Choose a JPG, PNG, or WebP image.'); return }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Profile photos must be 5 MB or smaller.'); return }
    setPhotoBusy(true)
    try {
      await uploadOwnEmployeePhoto(file)
      await refreshIdentity()
      setMessage('Profile photo updated successfully.')
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'The profile photo could not be updated.')
    } finally { setPhotoBusy(false) }
  }

  function openRequestDialog() {
    setFields({ email: currentEmployee.email ?? '', contact_number: currentEmployee.contact_number ?? '', permanent_address: currentEmployee.permanent_address ?? '', present_address: currentEmployee.present_address ?? '', religion: currentEmployee.religion ?? '', civil_status: currentEmployee.civil_status ?? '' })
    setReason('')
    setMessage('')
    setDialogOpen(true)
  }

  return <div>
    <PageHeading eyebrow="Employee portal" title="My profile" description="Change your profile photo instantly or submit personal information changes for administrator review." />
    {message && <Alert className="mb-6" variant={message.includes('successfully') || message.includes('submitted') ? 'default' : 'danger'}>{message}</Alert>}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(18rem,0.3fr)]">
      <Card>
        <CardHeader><CardTitle>Personal and employment information</CardTitle><CardDescription>Official employment fields remain protected from direct employee edits.</CardDescription></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <EmployeeAvatar photoPath={employee.photo_path} name={displayName} alt={displayName} className="h-24 w-24 rounded-2xl text-2xl" />
            <div><div className="text-xl font-black">{displayName}</div><div className="mt-1 text-sm text-muted-foreground">{employee.employee_number} · {employee.position?.name ?? 'Position not assigned'}</div><Badge className="mt-3" variant={employee.status === 'active' ? 'success' : 'muted'}>{employee.status}</Badge></div>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed bg-secondary/30 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">Profile photo</div><p className="mt-1 text-xs text-muted-foreground">You can replace this image without an administrator request. JPG, PNG, or WebP up to 5 MB.</p></div><label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition hover:bg-secondary"><ImagePlus className="h-4 w-4" />{photoBusy ? 'Uploading...' : 'Change photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handlePhoto} disabled={photoBusy} /></label></div>
            {photoError && <p className="mt-2 text-xs font-medium text-red-600">{photoError}</p>}
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2"><ReadOnly label="Email" value={employee.email} /><ReadOnly label="Contact number" value={employee.contact_number} /><ReadOnly label="Department" value={employee.department?.name} /><ReadOnly label="Position" value={employee.position?.name} /><ReadOnly label="Civil status" value={employee.civil_status} /><ReadOnly label="Birth date" value={employee.birth_date ? formatDate(employee.birth_date) : null} /><ReadOnly label="Permanent address" value={employee.permanent_address} /><ReadOnly label="Present address" value={employee.present_address} /></div>
          <Button className="mt-7" onClick={openRequestDialog}><Send className="h-4 w-4" />Request profile change</Button>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Account guidance</CardTitle><CardDescription>Keep your account secure and your personal details current.</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>Official employment data is controlled by your administrator. Requests are recorded for review.</p><p>Use Settings to change your password. Never share your employee number or password with another person.</p><Link className="inline-flex font-semibold text-primary hover:underline" to="/employee/settings">Open account settings</Link></CardContent></Card>
    </div>
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Request profile change" description="Your administrator will review these personal information changes before they become official."><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Email" value={fields.email} onChange={(value) => setFields((current) => ({ ...current, email: value }))} /><Field label="Contact number" value={fields.contact_number} onChange={(value) => setFields((current) => ({ ...current, contact_number: value }))} /><Field label="Civil status" value={fields.civil_status} onChange={(value) => setFields((current) => ({ ...current, civil_status: value }))} /><Field label="Religion" value={fields.religion} onChange={(value) => setFields((current) => ({ ...current, religion: value }))} /><Field label="Permanent address" value={fields.permanent_address} onChange={(value) => setFields((current) => ({ ...current, permanent_address: value }))} /><Field label="Present address" value={fields.present_address} onChange={(value) => setFields((current) => ({ ...current, present_address: value }))} /></div><div><Label htmlFor="profile-change-reason">Reason</Label><textarea id="profile-change-reason" className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this change is needed." /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={requestMutation.isPending} onClick={() => requestMutation.mutate()}><Send className="h-4 w-4" />{requestMutation.isPending ? 'Submitting...' : 'Submit request'}</Button></div></div></Dialog>
  </div>
}

function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) { return <div><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || 'Not set'}</div></div> }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} /></div> }
