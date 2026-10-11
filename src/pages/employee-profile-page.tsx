import { createContext, useContext, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, BriefcaseBusiness, Check, ChevronDown, FileDown, FileText, FileUp, Plus, Save, Trash2, Upload, UserRound } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeading } from '@/components/layout/page-heading'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getEmployeeDocumentUrl, getEmployeePhotoUrl, getEmployeeProfile, listDepartments, listPositions, previewNextEmployeeNumber, provisionEmployeeAccount, saveEmployeeProfile, uploadEmployeeDocument, uploadEmployeePhoto } from '@/services/api'
import { downloadEmployeeTemplate, parseEmployeeDocument, type ParsedEmployeeDocument } from '@/services/employee-docx'
import type { CharacterReference, Dependent, EducationalBackground, EmergencyContact, EmployeeIdentifier, EmployeeProfileData, EmployeeProfilePayload, EmploymentStatus, SalaryType } from '@/types/database'
import { formatDate, titleCase } from '@/lib/utils'

type AssignmentForm = { id?: string; department_id: string; position_id: string; department_name?: string; position_name?: string; start_date: string; end_date: string; is_primary: boolean }
type SalaryForm = { id?: string; assignment_id: string; salary_type: SalaryType; amount: string; effective_from: string; effective_to: string; source: string; is_approved: boolean }
type FormState = {
  employee: { employee_number: string; first_name: string; middle_name: string; last_name: string; gender: string; email: string; civil_status: string; nationality: string; religion: string; birth_date: string; permanent_address: string; present_address: string; contact_number: string; status: EmploymentStatus; auth_user_id: string | null; photo_path: string | null }
  emergency_contacts: EmergencyContact[]
  dependents: Dependent[]
  educational_backgrounds: EducationalBackground[]
  character_references: CharacterReference[]
  identifiers: EmployeeIdentifier[]
  assignments: AssignmentForm[]
  salary_history: SalaryForm[]
}

const today = () => new Date().toISOString().slice(0, 10)
const blankAssignment = (): AssignmentForm => ({ department_id: '', position_id: '', start_date: today(), end_date: '', is_primary: true })
const blankSalary = (): SalaryForm => ({ assignment_id: '', salary_type: 'monthly', amount: '', effective_from: today(), effective_to: '', source: '', is_approved: true })
const defaultIdentifierTypes = ['TIN', 'Pag-IBIG', 'PhilHealth', 'SSS']

class FormValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super('Review the highlighted fields before saving.')
  }
}

const FieldErrorsContext = createContext<Record<string, string>>({})

function withDefaultIdentifiers(identifiers: EmployeeIdentifier[]) {
  const normalized = identifiers.map((item) => defaultIdentifierTypes.some((type) => type.toLowerCase() === item.identifier_type.trim().toLowerCase()) && !item.identifier_value.trim() ? { ...item, identifier_value: 'N/A' } : item)
  const existingTypes = new Set(normalized.map((item) => item.identifier_type.trim().toLowerCase()))
  return [...normalized, ...defaultIdentifierTypes.filter((type) => !existingTypes.has(type.toLowerCase())).map((identifier_type) => ({ identifier_type, identifier_value: 'N/A' }))]
}

const emptyForm = (): FormState => ({
  employee: { employee_number: '', first_name: '', middle_name: '', last_name: '', gender: '', email: '', civil_status: '', nationality: '', religion: '', birth_date: '', permanent_address: '', present_address: '', contact_number: '', status: 'active', auth_user_id: null, photo_path: null },
  emergency_contacts: [],
  dependents: [],
  educational_backgrounds: [],
  character_references: [],
  identifiers: withDefaultIdentifiers([]),
  assignments: [blankAssignment()],
  salary_history: [],
})

function formFromProfile(data: EmployeeProfileData): FormState {
  return {
    employee: { employee_number: data.employee.employee_number, first_name: data.employee.first_name, middle_name: data.employee.middle_name ?? '', last_name: data.employee.last_name, gender: data.employee.gender ?? '', email: data.employee.email ?? '', civil_status: data.employee.civil_status ?? '', nationality: data.employee.nationality ?? '', religion: data.employee.religion ?? '', birth_date: data.employee.birth_date ?? '', permanent_address: data.employee.permanent_address ?? '', present_address: data.employee.present_address ?? '', contact_number: data.employee.contact_number ?? '', status: data.employee.status, auth_user_id: data.employee.auth_user_id, photo_path: data.employee.photo_path },
    emergency_contacts: data.emergency_contacts.map((item) => ({ ...item, name: item.name ?? '', relationship: item.relationship ?? '', address: item.address ?? '', contact: item.contact ?? '' })),
    dependents: data.dependents.map((item) => ({ ...item, name: item.name ?? '', relationship: item.relationship ?? '', birth_date: item.birth_date ?? '' })),
    educational_backgrounds: data.educational_backgrounds.map((item) => ({ ...item, level: item.level ?? '', school: item.school ?? '', address: item.address ?? '', school_year: item.school_year ?? '' })),
    character_references: data.character_references.map((item) => ({ ...item, name: item.name ?? '', occupation: item.occupation ?? '', address: item.address ?? '', contact: item.contact ?? '' })),
    identifiers: withDefaultIdentifiers(data.identifiers.map((item) => ({ ...item, identifier_type: item.identifier_type ?? '', identifier_value: item.identifier_value ?? '' }))),
    assignments: data.assignments.map((item) => ({ id: item.id, department_id: item.department_id ?? '', position_id: item.position_id ?? '', department_name: item.department?.name ?? '', position_name: item.position?.name ?? '', start_date: item.start_date, end_date: item.end_date ?? '', is_primary: item.is_primary })),
    salary_history: data.salary_history.map((item) => ({ id: item.id, assignment_id: item.assignment_id ?? '', salary_type: item.salary_type, amount: String(item.amount), effective_from: item.effective_from, effective_to: item.effective_to ?? '', source: item.source ?? '', is_approved: item.is_approved })),
  }
}

export function EmployeeProfilePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id || id === 'new'
  const profile = useQuery({ queryKey: ['employee-profile', id], queryFn: () => getEmployeeProfile(id!), enabled: !isNew })
  const numberPreview = useQuery({ queryKey: ['next-employee-number-preview'], queryFn: previewNextEmployeeNumber, enabled: isNew, staleTime: 15_000 })
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => listDepartments() })
  const positions = useQuery({ queryKey: ['positions'], queryFn: () => listPositions() })
  const [form, setForm] = useState<FormState>(emptyForm)
  const [pendingDocument, setPendingDocument] = useState<File | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busyImport, setBusyImport] = useState(false)
  const [dirty, setDirty] = useState(isNew)
  const [confirmLeave, setConfirmLeave] = useState(false)

  useEffect(() => {
    if (profile.data) {
      setForm(formFromProfile(profile.data))
      setDirty(false)
    }
  }, [profile.data])

  useEffect(() => {
    if (!dirty) return
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [dirty])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validationErrors = validateForm(form)
      if (Object.keys(validationErrors).length > 0) throw new FormValidationError(validationErrors)
      const payload = toPayload(form, isNew)
      const employeeId = await saveEmployeeProfile(payload, isNew ? undefined : id)
      const warnings: string[] = []
      if (form.employee.email && !form.employee.auth_user_id) {
        try { await provisionEmployeeAccount(employeeId, form.employee.email) } catch (accountError) { warnings.push(`The portal account was not created: ${errorMessage(accountError)} You can retry it from the employee directory.`) }
      }
      if (pendingPhoto) {
        try { await uploadEmployeePhoto(employeeId, pendingPhoto) } catch (photoError) { warnings.push(`The profile was saved, but the photo was not uploaded: ${errorMessage(photoError)}`) }
      }
      if (pendingDocument) {
        try { await uploadEmployeeDocument(employeeId, pendingDocument) } catch (documentError) { warnings.push(`The profile was saved, but the DOCX was not retained: ${errorMessage(documentError)}`) }
      }
      return { employeeId, warnings }
    },
    onSuccess: ({ employeeId, warnings }) => {
      setMessage(warnings.length ? `Employee profile saved. ${warnings.join(' ')}` : 'Employee profile saved successfully. The original DOCX is retained privately when one was imported.')
      setError('')
      setFieldErrors({})
      setDirty(false)
      setPendingDocument(null)
      setPendingPhoto(null)
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
      void queryClient.invalidateQueries({ queryKey: ['employee-profile', employeeId] })
      if (isNew) navigate(`/admin/employees/${employeeId}`, { replace: true })
    },
    onError: (saveError) => {
      if (saveError instanceof FormValidationError) {
        setFieldErrors(saveError.fields)
        setError(saveError.message)
      } else setError(errorMessage(saveError) || 'The employee profile could not be saved.')
    },
  })

  const activeDepartments = departments.data ?? []
  const activePositions = positions.data ?? []

  function markDirty() { setDirty(true); setError(''); setFieldErrors({}) }
  function updateEmployee(field: keyof FormState['employee'], value: string) { markDirty(); setForm((current) => ({ ...current, employee: { ...current.employee, [field]: value } })) }
  function updateRow<K extends keyof FormState>(key: K, index: number, value: FormState[K] extends Array<infer Item> ? Partial<Item> : never) { markDirty(); setForm((current) => ({ ...current, [key]: (current[key] as Array<Record<string, unknown>>).map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item) })) }
  function removeRow<K extends keyof FormState>(key: K, index: number) { markDirty(); setForm((current) => ({ ...current, [key]: (current[key] as unknown[]).filter((_, itemIndex) => itemIndex !== index) })) }
  function addRow(key: 'emergency_contacts' | 'dependents' | 'educational_backgrounds' | 'character_references' | 'identifiers' | 'assignments' | 'salary_history') {
    const blank: Record<string, unknown> = key === 'emergency_contacts' ? { name: '', relationship: '', address: '', contact: '' } : key === 'dependents' ? { name: '', relationship: '', birth_date: '' } : key === 'educational_backgrounds' ? { level: '', school: '', address: '', school_year: '' } : key === 'character_references' ? { name: '', occupation: '', address: '', contact: '' } : key === 'identifiers' ? { identifier_type: '', identifier_value: '' } : key === 'assignments' ? blankAssignment() : blankSalary()
    markDirty()
    setForm((current) => ({ ...current, [key]: [...(current[key] as unknown[]), blank] }))
  }

  async function handleDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusyImport(true)
    setError('')
    setImportWarnings([])
    try {
      const parsed = await parseEmployeeDocument(file)
      applyParsedDocument(parsed, activeDepartments, activePositions)
      setPendingDocument(file)
      markDirty()
    } catch {
      setError('The DOCX could not be read. Download the PMS template and try again.')
    } finally { setBusyImport(false) }
  }

  function applyParsedDocument(parsed: ParsedEmployeeDocument, departmentList: typeof activeDepartments, positionList: typeof activePositions) {
    const matchedAssignments = parsed.assignments.map((assignment) => {
      const department = departmentList.find((item) => normalizeName(item.name) === normalizeName(assignment.department_name))
      const position = positionList.find((item) => normalizeName(item.name) === normalizeName(assignment.position_name) && (!department || item.department_id === department.id))
      return { id: assignment.id, department_id: department?.id ?? '', position_id: position?.id ?? '', department_name: assignment.department_name, position_name: assignment.position_name, start_date: assignment.start_date || today(), end_date: assignment.end_date ?? '', is_primary: Boolean(assignment.is_primary) }
    })
    setForm((current) => ({ ...current, employee: { ...current.employee, ...parsed.employee, middle_name: parsed.employee.middle_name ?? '', gender: parsed.employee.gender ?? '', email: parsed.employee.email ?? '', civil_status: parsed.employee.civil_status ?? '', nationality: parsed.employee.nationality ?? '', religion: parsed.employee.religion ?? '', birth_date: parsed.employee.birth_date ?? '', permanent_address: parsed.employee.permanent_address ?? '', present_address: parsed.employee.present_address ?? '', contact_number: parsed.employee.contact_number ?? '' }, emergency_contacts: parsed.emergency_contacts, dependents: parsed.dependents, educational_backgrounds: parsed.educational_backgrounds, character_references: parsed.character_references, assignments: matchedAssignments.length ? matchedAssignments : current.assignments }))
    const unmatched = matchedAssignments.filter((assignment) => !assignment.department_id || !assignment.position_id).map((assignment) => `Match the extracted position "${assignment.position_name || 'blank'}" and department "${assignment.department_name || 'blank'}" in the organization catalog.`)
    setImportWarnings([...parsed.warnings, ...unmatched])
    setMessage(`Imported ${fileLabel(parsed)}. Review every required field before saving.`)
  }

  function handleLeave() { setConfirmLeave(true) }

  if (profile.isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-96" /></div>
  if (profile.isError) return <Alert variant="danger">The employee profile could not be loaded.</Alert>

  const currentProfile = profile.data
  const title = isNew ? 'Add employee' : `${form.employee.first_name} ${form.employee.last_name}`.trim() || 'Employee profile'

  return <FieldErrorsContext.Provider value={fieldErrors}><div className="pms-profile-form min-w-0 space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={handleLeave} className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl px-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to employees</button><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => void downloadEmployeeTemplate()}><FileDown className="h-4 w-4" />Download template</Button><label className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-background px-3 text-center text-sm font-semibold transition hover:bg-secondary sm:w-auto"><FileUp className="h-4 w-4" />{busyImport ? 'Reading DOCX...' : 'Import DOCX'}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={handleDocument} disabled={busyImport} /></label><Button type="button" className="col-span-2 w-full sm:w-auto" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save className="h-4 w-4" />{saveMutation.isPending ? 'Saving...' : 'Save employee'}</Button></div></div>
    <PageHeading eyebrow="People operations" title={title} description="Complete the official employee profile. Salary and government identifiers are managed by administrators and are not included in the employee DOCX form." />
    {message && <Alert variant="default">{message}</Alert>}
    {error && <Alert variant="danger"><div>{error}</div>{Object.entries(fieldErrors).length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{Object.values(fieldErrors).map((fieldError) => <li key={fieldError}>{fieldError}</li>)}</ul>}</Alert>}
    {importWarnings.length > 0 && <Alert variant="warning"><div className="font-semibold">Review the imported document</div><ul className="mt-2 list-disc space-y-1 pl-5">{importWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></Alert>}
    {pendingDocument && <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><div className="truncate font-semibold">{pendingDocument.name}</div><div className="text-xs text-muted-foreground">The original file will be retained privately after this profile is saved.</div></div><Badge>Pending save</Badge></div>}

    <Card><CardContent className="flex min-w-0 flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-black text-primary"><UserRound className="h-7 w-7" /></div><div className="min-w-0"><div className="truncate text-xl font-black">{form.employee.first_name || 'New'} {form.employee.last_name || 'employee'}</div><div className="mt-1 truncate text-sm text-muted-foreground">{form.employee.employee_number || numberPreview.data || 'Number assigned automatically'} · {form.employee.email || 'No portal email yet'}</div></div></div><div className="flex flex-wrap items-center gap-2"><Badge variant={form.employee.status === 'active' ? 'success' : 'muted'}>{titleCase(form.employee.status)}</Badge><Badge variant={form.employee.auth_user_id ? 'success' : 'warning'}>{form.employee.auth_user_id ? 'Portal account ready' : 'Portal account pending'}</Badge></div></CardContent></Card>
    <PhotoPicker existingPath={form.employee.photo_path} file={pendingPhoto} onSelect={(file) => { if (!file.type.startsWith('image/')) { setError('Choose an image file for the employee photo.'); return } if (file.size > 5 * 1024 * 1024) { setError('Employee photos must be 5 MB or smaller.'); return } setPendingPhoto(file); markDirty(); setMessage(`${file.name} will be stored with the employee profile when you save.`) }} />

    <SectionCard title="Personal information" description="Every official identity, contact, address, and employment status field is required."><div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReadOnlyField className="min-w-0" label="Employee number" value={form.employee.employee_number || numberPreview.data || 'Assigned automatically'} /><Field label="First name" value={form.employee.first_name} onChange={(value) => updateEmployee('first_name', value)} required /><Field label="Middle name" value={form.employee.middle_name} onChange={(value) => updateEmployee('middle_name', value)} required /><Field label="Last name" value={form.employee.last_name} onChange={(value) => updateEmployee('last_name', value)} required /><Field className="sm:col-span-2" label="Email for portal" type="email" value={form.employee.email} onChange={(value) => updateEmployee('email', value)} required /><Field label="Contact number" value={form.employee.contact_number} onChange={(value) => updateEmployee('contact_number', value)} required /><Field label="Birth date" type="date" value={form.employee.birth_date} onChange={(value) => updateEmployee('birth_date', value)} required /><SelectField label="Gender" value={form.employee.gender} onChange={(value) => updateEmployee('gender', value)} options={['Male', 'Female', 'Other']} required /><SuggestField label="Civil status" value={form.employee.civil_status} onChange={(value) => updateEmployee('civil_status', value)} options={['Single', 'Married', 'Widowed', 'Separated', 'Divorced', 'Other']} required /><SuggestField label="Nationality" value={form.employee.nationality} onChange={(value) => updateEmployee('nationality', value)} options={['Filipino', 'American', 'Australian', 'British', 'Canadian', 'Chinese', 'Japanese', 'Korean', 'Other']} required /><SuggestField label="Religion" value={form.employee.religion} onChange={(value) => updateEmployee('religion', value)} options={['Roman Catholic', 'Iglesia ni Cristo', 'Islam', 'Evangelical', 'Protestant', 'Buddhist', 'Hindu', "Jehovah's Witnesses", 'Other']} required /><TextAreaField className="min-w-0 sm:col-span-2" label="Permanent address" value={form.employee.permanent_address} onChange={(value) => updateEmployee('permanent_address', value)} required /><TextAreaField className="min-w-0 sm:col-span-2" label="Present address" value={form.employee.present_address} onChange={(value) => updateEmployee('present_address', value)} required /><SelectField className="sm:col-span-2 xl:col-span-4" label="Employment status" value={form.employee.status} onChange={(value) => updateEmployee('status', value as EmploymentStatus)} options={['active', 'inactive', 'on_leave', 'terminated']} optionLabels={{ active: 'Active', inactive: 'Archived', on_leave: 'On leave', terminated: 'Terminated' }} required /></div></SectionCard>

    <SectionCard title="Government identifiers" description="Sensitive identifiers are entered here by administrators and never included in the employee DOCX form." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('identifiers')}><Plus className="h-4 w-4" />Add identifier</Button>}><div className="space-y-3">{form.identifiers.length === 0 && <EmptyInline text="No identifiers added." />}{form.identifiers.map((row, index) => <div key={row.id ?? `identifier-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"><Field label="Type of Card" value={row.identifier_type} onChange={(value) => updateRow('identifiers', index, { identifier_type: value })} required /><Field label="Account ID Number" value={row.identifier_value} onChange={(value) => updateRow('identifiers', index, { identifier_value: value })} required /><RemoveButton onClick={() => removeRow('identifiers', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Emergency contacts" description="Add every person the organization should contact in an emergency." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('emergency_contacts')}><Plus className="h-4 w-4" />Add contact</Button>}><div className="space-y-3">{form.emergency_contacts.length === 0 && <EmptyInline text="No emergency contacts added." />}{form.emergency_contacts.map((row, index) => <div key={row.id ?? `emergency-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-3"><Field label="Name" value={row.name} onChange={(value) => updateRow('emergency_contacts', index, { name: value })} required /><Field label="Relationship" value={row.relationship} onChange={(value) => updateRow('emergency_contacts', index, { relationship: value })} required /><Field label="Contact" value={row.contact} onChange={(value) => updateRow('emergency_contacts', index, { contact: value })} required /><TextAreaField className="sm:col-span-3" label="Address" value={row.address} onChange={(value) => updateRow('emergency_contacts', index, { address: value })} required /><RemoveButton onClick={() => removeRow('emergency_contacts', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Dependents" description="Record dependents with their relationship and birth date." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('dependents')}><Plus className="h-4 w-4" />Add dependent</Button>}><div className="space-y-3">{form.dependents.length === 0 && <EmptyInline text="No dependents added." />}{form.dependents.map((row, index) => <div key={row.id ?? `dependent-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]"><Field label="Full name" value={row.name} onChange={(value) => updateRow('dependents', index, { name: value })} required /><Field label="Relationship" value={row.relationship} onChange={(value) => updateRow('dependents', index, { relationship: value })} required /><Field label="Birth date" type="date" value={row.birth_date} onChange={(value) => updateRow('dependents', index, { birth_date: value })} required /><RemoveButton onClick={() => removeRow('dependents', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Educational background" description="Capture schooling and completion details for the employee record." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('educational_backgrounds')}><Plus className="h-4 w-4" />Add education</Button>}><div className="space-y-3">{form.educational_backgrounds.length === 0 && <EmptyInline text="No educational background added." />}{form.educational_backgrounds.map((row, index) => <div key={row.id ?? `education-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)_minmax(0,0.75fr)]"><Field label="Level" value={row.level} onChange={(value) => updateRow('educational_backgrounds', index, { level: value })} required /><Field label="School" value={row.school} onChange={(value) => updateRow('educational_backgrounds', index, { school: value })} required /><Field label="School year" value={row.school_year} onChange={(value) => updateRow('educational_backgrounds', index, { school_year: value })} required /><TextAreaField className="sm:col-span-3" label="Address" value={row.address} onChange={(value) => updateRow('educational_backgrounds', index, { address: value })} required /><RemoveButton onClick={() => removeRow('educational_backgrounds', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Character references" description="Keep trusted reference contacts attached to the employee profile." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('character_references')}><Plus className="h-4 w-4" />Add reference</Button>}><div className="space-y-3">{form.character_references.length === 0 && <EmptyInline text="No character references added." />}{form.character_references.map((row, index) => <div key={row.id ?? `reference-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-3"><Field label="Name" value={row.name} onChange={(value) => updateRow('character_references', index, { name: value })} required /><Field label="Occupation" value={row.occupation} onChange={(value) => updateRow('character_references', index, { occupation: value })} required /><Field label="Contact" value={row.contact} onChange={(value) => updateRow('character_references', index, { contact: value })} required /><TextAreaField className="sm:col-span-3" label="Address" value={row.address} onChange={(value) => updateRow('character_references', index, { address: value })} required /><RemoveButton onClick={() => removeRow('character_references', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Position and assignment" description="Maintain the current and historical position assignments used by payroll and reporting." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('assignments')}><Plus className="h-4 w-4" />Add assignment</Button>}><div className="space-y-3">{form.assignments.length === 0 && <EmptyInline text="No position assignment added." />}{form.assignments.map((row, index) => { const filteredPositions = activePositions.filter((position) => !row.department_id || position.department_id === row.department_id); return <div key={row.id ?? `assignment-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_auto]"><SelectField label="Department" value={row.department_id} onChange={(value) => updateRow('assignments', index, { department_id: value, position_id: '' })} options={activeDepartments.map((department) => department.id)} optionLabels={Object.fromEntries(activeDepartments.map((department) => [department.id, department.name]))} required /><SelectField label="Position" value={row.position_id} onChange={(value) => updateRow('assignments', index, { position_id: value })} options={filteredPositions.map((position) => position.id)} optionLabels={Object.fromEntries(filteredPositions.map((position) => [position.id, position.name]))} required /><Field label="Start date" type="date" value={row.start_date} onChange={(value) => updateRow('assignments', index, { start_date: value })} required /><Field label="End date (optional)" type="date" min={row.start_date} value={row.end_date} onChange={(value) => updateRow('assignments', index, { end_date: value })} /><label className="flex min-h-10 items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={row.is_primary} onChange={(event) => { markDirty(); setForm((current) => ({ ...current, assignments: current.assignments.map((item, itemIndex) => ({ ...item, is_primary: itemIndex === index ? event.target.checked : false })) })) }} />Primary</label><RemoveButton onClick={() => removeRow('assignments', index)} /></div> })}</div></SectionCard>

    <SectionCard title="Salary history" description="Configure effective-dated compensation here. These values are not read from the employee DOCX." action={<Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => addRow('salary_history')}><Plus className="h-4 w-4" />Add salary</Button>}><div className="space-y-3">{form.salary_history.length === 0 && <EmptyInline text="No salary history added. Payroll cannot run until an approved salary exists." />}{form.salary_history.map((row, index) => <div key={row.id ?? `salary-${index}`} className="relative grid min-w-0 gap-4 rounded-2xl border p-4 pr-14 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"><SelectField label="Salary type" value={row.salary_type} onChange={(value) => updateRow('salary_history', index, { salary_type: value as SalaryType })} options={['monthly', 'daily', 'hourly']} required /><Field label="Amount" type="number" min="0.01" step="0.01" value={row.amount} onChange={(value) => updateRow('salary_history', index, { amount: value })} required /><Field label="Effective from" type="date" value={row.effective_from} onChange={(value) => updateRow('salary_history', index, { effective_from: value })} required /><Field label="Effective to (optional)" type="date" min={row.effective_from} value={row.effective_to} onChange={(value) => updateRow('salary_history', index, { effective_to: value })} /><Field className="sm:col-span-3" label="Source" value={row.source} onChange={(value) => updateRow('salary_history', index, { source: value })} required /><label className="flex min-h-10 items-center gap-2 self-end text-sm font-semibold"><input type="checkbox" checked={row.is_approved} onChange={(event) => updateRow('salary_history', index, { is_approved: event.target.checked })} />Approved</label><RemoveButton onClick={() => removeRow('salary_history', index)} /></div>)}</div></SectionCard>

    <SectionCard title="Retained documents" description="Completed employee DOCX forms are stored privately for administrator audit access."><div className="space-y-3">{currentProfile?.documents.length ? currentProfile.documents.map((document) => <div key={document.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><FileText className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><div className="truncate font-semibold">{document.original_name}</div><div className="text-xs text-muted-foreground">Stored {formatDate(document.created_at.slice(0, 10))} · {document.parser_version}</div></div></div><Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={async () => { try { const url = await getEmployeeDocumentUrl(document.storage_path); window.open(url, '_blank', 'noopener,noreferrer') } catch { setError('The private document could not be opened.') } }}>Open private copy</Button></div>) : <EmptyInline text="No retained DOCX form yet." />}</div></SectionCard>

    <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)} title="Leave employee profile?" description={dirty || pendingDocument || pendingPhoto ? 'Your unsaved changes and pending uploads will be lost.' : 'Return to the employee directory?'}><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setConfirmLeave(false)}>Stay here</Button><Button type="button" variant="danger" onClick={() => navigate('/admin/employees')}>Leave profile</Button></div></Dialog>
  </div></FieldErrorsContext.Provider>
}

function toPayload(form: FormState, isNew: boolean): EmployeeProfilePayload {
  const primary = form.assignments.find((item) => item.is_primary)
  return {
    employee: { ...form.employee, employee_number: isNew ? undefined : form.employee.employee_number || undefined, current_department_id: primary?.department_id || null, current_position_id: primary?.position_id || null },
    emergency_contacts: form.emergency_contacts,
    dependents: form.dependents,
    educational_backgrounds: form.educational_backgrounds,
    character_references: form.character_references,
    identifiers: form.identifiers.filter((item) => item.identifier_type.trim() && item.identifier_value.trim()).map((item) => ({ identifier_type: item.identifier_type.trim(), identifier_value: item.identifier_value.trim() })),
    assignments: form.assignments.filter((item) => item.department_id && item.position_id).map((item) => ({ id: item.id, department_id: item.department_id, position_id: item.position_id, start_date: item.start_date, end_date: item.end_date || null, is_primary: item.is_primary })),
    salary_history: form.salary_history.filter((item) => item.amount && item.effective_from).map((item) => ({ id: item.id, assignment_id: item.assignment_id || null, salary_type: item.salary_type, amount: Number(item.amount), effective_from: item.effective_from, effective_to: item.effective_to || null, source: item.source.trim() || null, is_approved: item.is_approved })),
  }
}

function validateForm(form: FormState) {
  const errors: Record<string, string> = {}
  const requiredEmployeeFields: Array<[keyof FormState['employee'], string]> = [['first_name', 'First name'], ['middle_name', 'Middle name'], ['last_name', 'Last name'], ['email', 'Email'], ['contact_number', 'Contact number'], ['birth_date', 'Birth date'], ['gender', 'Gender'], ['civil_status', 'Civil status'], ['nationality', 'Nationality'], ['religion', 'Religion'], ['permanent_address', 'Permanent address'], ['present_address', 'Present address']]
  requiredEmployeeFields.forEach(([field, label]) => { if (!String(form.employee[field] ?? '').trim()) errors[field] = `${label} is required.` })
  if (form.employee.email.trim() && !/^\S+@\S+\.\S+$/.test(form.employee.email.trim())) errors.email = 'Enter a valid email address.'
  if (!form.employee.status) errors.status = 'Employment status is required.'

  const contactIncomplete = form.emergency_contacts.some((row) => hasValue(row) && (!row.name.trim() || !row.relationship.trim() || !row.address.trim() || !row.contact.trim()))
  if (contactIncomplete) errors.emergency_contacts = 'Complete name, relationship, contact, and address for every emergency contact, or remove the unused row.'
  const dependentIncomplete = form.dependents.some((row) => hasValue(row) && (!row.name.trim() || !row.relationship.trim() || !row.birth_date.trim()))
  if (dependentIncomplete) errors.dependents = 'Complete name, relationship, and birth date for every dependent, or remove the unused row.'
  const educationIncomplete = form.educational_backgrounds.some((row) => hasValue(row) && (!row.level.trim() || !row.school.trim() || !row.address.trim() || !row.school_year.trim()))
  if (educationIncomplete) errors.educational_backgrounds = 'Complete level, school, school year, and address for every education row, or remove the unused row.'
  const referenceIncomplete = form.character_references.some((row) => hasValue(row) && (!row.name.trim() || !row.occupation.trim() || !row.address.trim() || !row.contact.trim()))
  if (referenceIncomplete) errors.character_references = 'Complete name, occupation, contact, and address for every reference, or remove the unused row.'
  if (form.assignments.some((assignment) => hasAssignmentValue(assignment) && (!assignment.department_id || !assignment.position_id || !assignment.start_date))) errors.assignments = 'Complete department, position, and start date for every assignment, or remove the unused row.'
  if (form.assignments.some((assignment) => hasAssignmentValue(assignment) && assignment.end_date && assignment.end_date < assignment.start_date)) errors.assignments = 'Assignment end dates must be on or after the start date.'
  if (form.salary_history.some((salary) => hasSalaryValue(salary) && (!salary.amount || Number(salary.amount) <= 0 || !salary.effective_from || !salary.source.trim()))) errors.salary_history = 'Complete salary type, positive amount, effective start date, and source for every salary row, or remove the unused row.'
  if (form.salary_history.some((salary) => hasSalaryValue(salary) && salary.effective_to && salary.effective_to < salary.effective_from)) errors.salary_history = 'Salary end dates must be on or after the effective start date.'
  if (form.identifiers.some((identifier) => Boolean(identifier.identifier_type.trim() || identifier.identifier_value.trim()) && (!identifier.identifier_type.trim() || !identifier.identifier_value.trim()))) errors.identifiers = 'Complete both the identifier type and account ID number, or remove the unused row.'
  return errors
}

function hasValue(row: object) { return Object.values(row).some((value) => typeof value === 'string' ? value.trim() : Boolean(value)) }
function hasAssignmentValue(row: AssignmentForm) { return Boolean(row.department_id || row.position_id || row.department_name || row.position_name || row.end_date) }
function hasSalaryValue(row: SalaryForm) { return Boolean(row.amount || row.assignment_id || row.effective_to || row.source.trim()) }
function normalizeName(value: string) { return value.trim().toLowerCase().replace(/\s+/g, ' ') }
function fileLabel(parsed: ParsedEmployeeDocument) { return parsed.employee.first_name || parsed.employee.last_name ? `${parsed.employee.first_name} ${parsed.employee.last_name}`.trim() : 'employee information' }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'The request could not be completed.' }

function SectionCard({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) { return <Card><CardHeader><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><CardTitle className="flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 shrink-0 text-primary" />{title}</CardTitle><CardDescription>{description}</CardDescription></div>{action}</div></CardHeader><CardContent className="min-w-0">{children}</CardContent></Card> }

function PhotoPicker({ existingPath, file, onSelect }: { existingPath: string | null; file: File | null; onSelect: (file: File) => void }) {
  const [savedUrl, setSavedUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    if (!existingPath) setSavedUrl(null)
    else if (existingPath.startsWith('http')) setSavedUrl(existingPath)
    else void getEmployeePhotoUrl(existingPath).then((url) => { if (active) setSavedUrl(url) }).catch(() => { if (active) setSavedUrl(null) })
    return () => { active = false }
  }, [existingPath])
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const photoUrl = previewUrl ?? savedUrl
  return <Card><CardContent className="flex min-w-0 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-4"><div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-primary/10 text-primary">{photoUrl ? <img src={photoUrl} alt="Employee" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9" />}</div><div className="min-w-0"><div className="font-semibold">Employee photo</div><div className="mt-1 max-w-md text-sm text-muted-foreground">Optional private profile image. Choose a clear image up to 5 MB; the preview updates immediately.</div>{file ? <div className="mt-1 truncate text-xs font-semibold text-primary">Pending: {file.name}</div> : savedUrl && <div className="mt-1 text-xs font-semibold text-emerald-600">Current photo</div>}</div></div><label className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-4 text-sm font-semibold transition hover:bg-secondary sm:w-auto"><Upload className="h-4 w-4" />{file || savedUrl ? 'Choose another photo' : 'Choose photo'}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ''; if (selected) onSelect(selected) }} /></label></CardContent></Card>
}

function fieldErrorFor(label: string, errors: Record<string, string>) {
  const fieldMap: Record<string, string> = { 'First name': 'first_name', 'Middle name': 'middle_name', 'Last name': 'last_name', 'Email for portal': 'email', Email: 'email', 'Contact number': 'contact_number', 'Birth date': 'birth_date', Gender: 'gender', 'Civil status': 'civil_status', Nationality: 'nationality', Religion: 'religion', 'Permanent address': 'permanent_address', 'Present address': 'present_address', 'Employment status': 'status' }
  if (fieldMap[label]) return errors[fieldMap[label]]
  if (['Department', 'Position', 'Start date', 'End date (optional)'].includes(label)) return errors.assignments
  if (['Salary type', 'Amount', 'Effective from', 'Effective to (optional)', 'Source'].includes(label)) return errors.salary_history
  if (['Type of Card', 'Account ID Number'].includes(label)) return errors.identifiers
  if (['Name', 'Relationship', 'Contact', 'Address'].includes(label)) return errors.emergency_contacts || errors.dependents || errors.character_references
  return undefined
}

function Field({ label, value, onChange, type = 'text', placeholder, required = false, className = '', min, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; required?: boolean; className?: string; min?: string; step?: string }) {
  const error = fieldErrorFor(label, useContext(FieldErrorsContext))
  return <div className={className}><Label>{label}{required && <span className="ml-1 text-red-600">*</span>}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} min={min} step={step} aria-invalid={Boolean(error)} className={error ? 'border-red-500 focus:border-red-500' : undefined} />{error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}</div>
}

function TextAreaField({ label, value, onChange, className = '', required = false }: { label: string; value: string; onChange: (value: string) => void; className?: string; required?: boolean }) {
  const error = fieldErrorFor(label, useContext(FieldErrorsContext))
  return <div className={className}><Label>{label}{required && <span className="ml-1 text-red-600">*</span>}</Label><textarea required={required} aria-invalid={Boolean(error)} className={`min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none ring-offset-background transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${error ? 'border-red-500' : ''}`} value={value} onChange={(event) => onChange(event.target.value)} />{error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}</div>
}

function ReadOnlyField({ label, value, className = '' }: { label: string; value: string; className?: string }) { return <div className={className}><Label>{label}</Label><div className="flex min-h-10 min-w-0 items-center rounded-xl border bg-secondary/50 px-3 text-sm font-semibold text-muted-foreground">{value}</div></div> }

function SelectField({ label, value, onChange, options, optionLabels = {}, className = '', required = false }: { label: string; value: string; onChange: (value: string) => void; options: string[]; optionLabels?: Record<string, string>; className?: string; required?: boolean }) {
  const error = fieldErrorFor(label, useContext(FieldErrorsContext))
  return <div className={className}><Label>{label}{required && <span className="ml-1 text-red-600">*</span>}</Label><div className="relative"><select required={required} aria-invalid={Boolean(error)} className={`h-10 w-full appearance-none rounded-lg border bg-background px-3 pr-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 ${error ? 'border-red-500' : ''}`} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{optionLabels[option] ?? titleCase(option)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /></div>{error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}</div>
}

function SuggestField({ label, value, onChange, options, className = '', required = false }: { label: string; value: string; onChange: (value: string) => void; options: string[]; className?: string; required?: boolean }) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const error = fieldErrorFor(label, useContext(FieldErrorsContext))
  const suggestions = options.filter((option) => option.toLowerCase().includes(value.toLowerCase())).slice(0, 8)
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length) }
    if (event.key === 'Enter') { event.preventDefault(); onChange(suggestions[activeIndex]); setOpen(false) }
    if (event.key === 'Escape') setOpen(false)
  }
  return <div ref={rootRef} className={`relative min-w-0 ${className}`}><Label>{label}{required && <span className="ml-1 text-red-600">*</span>}</Label><div className="relative"><Input required={required} value={value} onChange={(event) => { onChange(event.target.value); setActiveIndex(0); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} role="combobox" aria-expanded={open} aria-autocomplete="list" aria-invalid={Boolean(error)} className={error ? 'border-red-500' : undefined} /><ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /></div>{error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}{open && suggestions.length > 0 && <div className="absolute inset-x-0 top-[4.5rem] z-40 overflow-hidden rounded-xl border bg-card p-1 shadow-xl" role="listbox">{suggestions.map((suggestion, index) => <button type="button" key={suggestion} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${index === activeIndex ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(suggestion); setOpen(false) }}>{suggestion}{index === activeIndex && <Check className="h-4 w-4" />}</button>)}</div>}</div>
}

function RemoveButton({ onClick }: { onClick: () => void }) { return <Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-8 w-8 text-muted-foreground hover:text-red-600" onClick={onClick} aria-label="Remove row"><Trash2 className="h-4 w-4" /></Button> }
function EmptyInline({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">{text}</div> }
