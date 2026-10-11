import { supabase } from '@/lib/supabase'
import type {
  Attendance,
  CharacterReference,
  DashboardStats,
  Dependent,
  Department,
  Employee,
  EmployeeDocument,
  EmployeeLoan,
  EmployeeProfileData,
  EmployeeProfilePayload,
  EmployeePayslip,
  EmployeeAssignment,
  EducationalBackground,
  EmergencyContact,
  EmployeeIdentifier,
  LoanType,
  Notification,
  OtherTransaction,
  PayrollPeriod,
  PayrollRecord,
  Position,
  Profile,
  ProfileChangeRequest,
  SalaryHistory,
} from '@/types/database'

function throwIfError(error: { message?: string } | null) {
  if (!error) return
  const message = error.message || ''
  if (/supabase|postgrest|postgres|edge function|jwt|row-level security|failed to fetch/i.test(message)) throw new Error('The PMS service could not complete that request.')
  throw new Error(message || 'The PMS request could not be completed.')
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase.from('pms_profiles').select('*').eq('id', userId).maybeSingle()
  throwIfError(error)
  return data as Profile | null
}

export async function getRole(userId: string) {
  const { data, error } = await supabase.from('pms_user_roles').select('role').eq('user_id', userId).maybeSingle()
  throwIfError(error)
  return (data?.role ?? null) as 'admin' | 'employee' | null
}

export async function getLinkedEmployee(userId: string) {
  const { data, error } = await supabase
    .from('pms_employees')
    .select('*, department:pms_departments(id,name), position:pms_positions(id,name)')
    .eq('auth_user_id', userId)
    .maybeSingle()
  throwIfError(error)
  return data as Employee | null
}

export async function listEmployees(search = '') {
  let query = supabase
    .from('pms_employees')
    .select('*, department:pms_departments(id,name), position:pms_positions(id,name)')
    .order('last_name', { ascending: true })
  if (search.trim()) {
    const term = search.trim().replace(/[%(),]/g, '')
    query = query.or(`employee_number.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
  }
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as Employee[]
}

export async function createEmployee(values: Partial<Employee> & { employee_number: string; first_name: string; last_name: string; department_id?: string; position_id?: string }) {
  const { data, error } = await supabase.from('pms_employees').insert({
    employee_number: values.employee_number.trim(),
    first_name: values.first_name.trim(),
    middle_name: values.middle_name?.trim() || null,
    last_name: values.last_name.trim(),
    gender: values.gender || null,
    email: values.email?.trim().toLowerCase() || null,
    civil_status: values.civil_status || null,
    nationality: values.nationality || null,
    religion: values.religion || null,
    birth_date: values.birth_date || null,
    permanent_address: values.permanent_address || null,
    present_address: values.present_address || null,
    contact_number: values.contact_number || null,
    current_department_id: values.department_id || null,
    current_position_id: values.position_id || null,
    status: values.status || 'active',
  }).select('*, department:pms_departments(id,name), position:pms_positions(id,name)').single()
  throwIfError(error)
  return data as Employee
}

export async function getEmployeeProfile(id: string): Promise<EmployeeProfileData> {
  const responses = await Promise.all([
    supabase.from('pms_employees').select('*, department:pms_departments(id,name), position:pms_positions(id,name)').eq('id', id).single(),
    supabase.from('pms_emergency_contacts').select('*').eq('employee_id', id).order('created_at'),
    supabase.from('pms_dependents').select('*').eq('employee_id', id).order('created_at'),
    supabase.from('pms_educational_backgrounds').select('*').eq('employee_id', id).order('created_at'),
    supabase.from('pms_character_references').select('*').eq('employee_id', id).order('created_at'),
    supabase.from('pms_employee_identifiers').select('*').eq('employee_id', id).order('identifier_type'),
    supabase.from('pms_employee_assignments').select('*, department:pms_departments(id,name), position:pms_positions(id,name)').eq('employee_id', id).order('start_date', { ascending: false }),
    supabase.from('pms_employee_salary_history').select('*').eq('employee_id', id).order('effective_from', { ascending: false }),
    supabase.from('pms_employee_documents').select('*').eq('employee_id', id).order('created_at', { ascending: false }),
  ])
  responses.forEach((response) => throwIfError(response.error))
  return {
    employee: responses[0].data as Employee,
    emergency_contacts: (responses[1].data ?? []) as EmergencyContact[],
    dependents: (responses[2].data ?? []) as Dependent[],
    educational_backgrounds: (responses[3].data ?? []) as EducationalBackground[],
    character_references: (responses[4].data ?? []) as CharacterReference[],
    identifiers: (responses[5].data ?? []) as EmployeeIdentifier[],
    assignments: (responses[6].data ?? []) as EmployeeAssignment[],
    salary_history: (responses[7].data ?? []) as SalaryHistory[],
    documents: (responses[8].data ?? []) as EmployeeDocument[],
  }
}

export async function saveEmployeeProfile(payload: EmployeeProfilePayload, employeeId?: string) {
  const { data, error } = await supabase.rpc('pms_save_employee_profile', { p_payload: payload, p_employee_id: employeeId || null })
  throwIfError(error)
  return data as string
}

export async function previewNextEmployeeNumber() {
  const { data, error } = await supabase.rpc('pms_next_employee_number')
  throwIfError(error)
  if (!data) throw new Error('The employee number could not be previewed.')
  return data as string
}

export async function uploadEmployeeDocument(employeeId: string, file: File) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'employee-form.docx'
  const storagePath = `${employeeId}/forms/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage.from('pms-employee-documents').upload(storagePath, file, { contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', upsert: false })
  throwIfError(uploadError)
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('pms_employee_documents').insert({ employee_id: employeeId, storage_path: storagePath, original_name: file.name, uploaded_by: userData.user?.id ?? null }).select().single()
  if (error) {
    await supabase.storage.from('pms-employee-documents').remove([storagePath])
    throwIfError(error)
  }
  return data as EmployeeDocument
}

export async function uploadEmployeePhoto(employeeId: string, file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const storagePath = `${employeeId}/profile-${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from('pms-employee-avatars').upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: false })
  throwIfError(uploadError)
  const { data, error } = await supabase.from('pms_employees').update({ photo_path: storagePath }).eq('id', employeeId).select('photo_path').single()
  if (error) {
    await supabase.storage.from('pms-employee-avatars').remove([storagePath])
    throwIfError(error)
  }
  if (!data) throw new Error('The employee photo was uploaded, but the employee record was not updated.')
  return data.photo_path as string
}

export async function getEmployeePhotoUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('pms-employee-avatars').createSignedUrl(storagePath, 300)
  throwIfError(error)
  if (!data) throw new Error('The employee photo link could not be created.')
  return data.signedUrl
}

export async function getEmployeeDocumentUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('pms-employee-documents').createSignedUrl(storagePath, 300)
  throwIfError(error)
  if (!data) throw new Error('The document link could not be created.')
  return data.signedUrl
}

export async function completePasswordChange() {
  const { error } = await supabase.rpc('pms_complete_password_change')
  throwIfError(error)
}

export async function updateEmployeeStatus(id: string, status: Employee['status']) {
  const { data, error } = await supabase.from('pms_employees').update({ status }).eq('id', id).select('*, department:pms_departments(id,name), position:pms_positions(id,name)').single()
  throwIfError(error)
  return data as Employee
}

export async function provisionEmployeeAccount(employeeId: string, email: string) {
  const { data, error } = await supabase.functions.invoke('provision-employee', { body: { employee_id: employeeId, email } })
  if (error) throw new Error('The employee portal account could not be created.')
  return data
}

export async function getEmployeeAssignments(employeeId: string) {
  const { data, error } = await supabase
    .from('pms_employee_assignments')
    .select('*, department:pms_departments(id,name), position:pms_positions(id,name)')
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false })
  throwIfError(error)
  return (data ?? []) as EmployeeAssignment[]
}

export async function getSalaryHistory(employeeId: string) {
  const { data, error } = await supabase.from('pms_employee_salary_history').select('*').eq('employee_id', employeeId).order('effective_from', { ascending: false })
  throwIfError(error)
  return (data ?? []) as SalaryHistory[]
}

export async function listSalaryHistory() {
  const { data, error } = await supabase.from('pms_employee_salary_history').select('*, employee:pms_employees(id,employee_number,first_name,last_name), assignment:pms_employee_assignments(id,position:pms_positions(id,name),department:pms_departments(id,name))').order('effective_from', { ascending: false })
  throwIfError(error)
  return data ?? []
}

export async function createSalaryHistory(values: { employee_id: string; salary_type: 'monthly' | 'daily' | 'hourly'; amount: number; effective_from: string; effective_to?: string; is_approved: boolean; source?: string }) {
  const { data, error } = await supabase.from('pms_employee_salary_history').insert({ ...values, effective_to: values.effective_to || null, source: values.source || 'administrator configuration' }).select().single()
  throwIfError(error)
  return data
}

export async function approveSalaryHistory(id: string, isApproved: boolean) {
  const { data, error } = await supabase.from('pms_employee_salary_history').update({ is_approved: isApproved }).eq('id', id).select().single()
  throwIfError(error)
  return data
}

export async function listDepartments(includeInactive = false) {
  let query = supabase.from('pms_departments').select('*').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as Department[]
}

export async function createDepartment(values: { name: string; description?: string }) {
  const { data, error } = await supabase.from('pms_departments').insert({ name: values.name.trim().toUpperCase(), description: values.description?.trim() || null }).select().single()
  throwIfError(error)
  return data as Department
}

export async function updateDepartment(id: string, values: { name: string; description?: string; is_active?: boolean }) {
  const { data, error } = await supabase.from('pms_departments').update({ name: values.name.trim().toUpperCase(), description: values.description?.trim() || null, is_active: values.is_active }).eq('id', id).select().single()
  throwIfError(error)
  return data as Department
}

export async function listPositions(includeInactive = false) {
  let query = supabase.from('pms_positions').select('*, department:pms_departments(id,name)').order('name')
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as Position[]
}

export async function createPosition(values: { name: string; department_id?: string; description?: string }) {
  const { data, error } = await supabase.from('pms_positions').insert({ name: values.name.trim().toUpperCase(), department_id: values.department_id || null, description: values.description?.trim() || null }).select().single()
  throwIfError(error)
  return data as Position
}

export async function updatePosition(id: string, values: { name: string; department_id?: string; description?: string; is_active?: boolean }) {
  const { data, error } = await supabase.from('pms_positions').update({ name: values.name.trim().toUpperCase(), department_id: values.department_id || null, description: values.description?.trim() || null, is_active: values.is_active }).eq('id', id).select().single()
  throwIfError(error)
  return data as Position
}

export async function listPayrollPeriods() {
  const { data, error } = await supabase.from('pms_payroll_periods').select('*').order('start_date', { ascending: false })
  throwIfError(error)
  return (data ?? []) as PayrollPeriod[]
}

export async function createPayrollPeriod(values: Pick<PayrollPeriod, 'name' | 'start_date' | 'end_date' | 'pay_date' | 'frequency'>) {
  const { data, error } = await supabase.from('pms_payroll_periods').insert({ ...values, status: 'draft' }).select().single()
  throwIfError(error)
  return data as PayrollPeriod
}

export async function listAttendance(periodId?: string) {
  let query = supabase.from('pms_employee_attendance').select('*, employee:pms_employees(id,employee_number,first_name,last_name)').order('created_at', { ascending: false })
  if (periodId) query = query.eq('payroll_period_id', periodId)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as Attendance[]
}

export async function saveAttendance(values: Omit<Attendance, 'id' | 'created_at' | 'updated_at' | 'employee'>) {
  const { data, error } = await supabase.from('pms_employee_attendance').upsert(values, { onConflict: 'payroll_period_id,employee_id' }).select('*, employee:pms_employees(id,employee_number,first_name,last_name)').single()
  throwIfError(error)
  return data as Attendance
}

export async function listLoanTypes() {
  const { data, error } = await supabase.from('pms_loan_types').select('*').order('name')
  throwIfError(error)
  return (data ?? []) as LoanType[]
}

export async function createLoanType(values: { name: string; description?: string; default_terms?: number }) {
  const { data, error } = await supabase.from('pms_loan_types').insert({ name: values.name.trim(), description: values.description?.trim() || null, default_terms: values.default_terms || null }).select().single()
  throwIfError(error)
  return data as LoanType
}

export async function listEmployeeLoans() {
  const { data, error } = await supabase.from('pms_employee_loans').select('*, employee:pms_employees(id,employee_number,first_name,last_name), loan_type:pms_loan_types(id,name)').order('loan_date', { ascending: false })
  throwIfError(error)
  return (data ?? []) as EmployeeLoan[]
}

export async function createEmployeeLoan(values: Omit<EmployeeLoan, 'id' | 'outstanding_balance' | 'status' | 'employee' | 'loan_type'>) {
  const { data, error } = await supabase.from('pms_employee_loans').insert({ ...values, outstanding_balance: values.principal_amount, status: 'active' }).select('*, employee:pms_employees(id,employee_number,first_name,last_name), loan_type:pms_loan_types(id,name)').single()
  throwIfError(error)
  return data as EmployeeLoan
}

export async function updateLoanPriority(id: string, priority: number | null) {
  const { data, error } = await supabase.from('pms_employee_loans').update({ priority }).eq('id', id).select('*, employee:pms_employees(id,employee_number,first_name,last_name), loan_type:pms_loan_types(id,name)').single()
  throwIfError(error)
  return data as EmployeeLoan
}

export async function listOtherTransactions(kind: 'income' | 'deduction', periodId?: string) {
  const table = kind === 'income' ? 'pms_other_income' : 'pms_other_deductions'
  let query = supabase.from(table).select('*, employee:pms_employees(id,employee_number,first_name,last_name)').order('created_at', { ascending: false })
  if (periodId) query = query.eq('payroll_period_id', periodId)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as OtherTransaction[]
}

export async function createOtherTransaction(kind: 'income' | 'deduction', values: { payroll_period_id: string; employee_id: string; transaction_type: string; amount: number; description?: string }) {
  const table = kind === 'income' ? 'pms_other_income' : 'pms_other_deductions'
  const { data, error } = await supabase.from(table).insert({ ...values, description: values.description?.trim() || null, status: 'pending' }).select('*, employee:pms_employees(id,employee_number,first_name,last_name)').single()
  throwIfError(error)
  return data as OtherTransaction
}

export async function updateOtherTransactionStatus(kind: 'income' | 'deduction', id: string, status: 'approved' | 'rejected') {
  const table = kind === 'income' ? 'pms_other_income' : 'pms_other_deductions'
  const { data, error } = await supabase.from(table).update({ status }).eq('id', id).select().single()
  throwIfError(error)
  return data as OtherTransaction
}

export async function listPayrollRecords(periodId?: string) {
  let query = supabase.from('pms_payroll_records').select('*, employee:pms_employees(id,employee_number,first_name,last_name)').order('created_at', { ascending: false })
  if (periodId) query = query.eq('payroll_period_id', periodId)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as PayrollRecord[]
}

export async function previewPayroll(periodId: string) {
  const { data, error } = await supabase.rpc('pms_preview_payroll', { p_payroll_period_id: periodId })
  throwIfError(error)
  return data as PayrollRecord[]
}

export async function finalizePayroll(periodId: string, idempotencyKey: string) {
  const { data, error } = await supabase.rpc('pms_finalize_payroll', { p_payroll_period_id: periodId, p_idempotency_key: idempotencyKey })
  throwIfError(error)
  return data
}

export async function markPayrollPaid(periodId: string) {
  const { data, error } = await supabase.rpc('pms_mark_payroll_paid', { p_payroll_period_id: periodId })
  throwIfError(error)
  return data
}

export async function publishPayslips(periodId: string) {
  const { data, error } = await supabase.rpc('pms_publish_payslips', { p_payroll_period_id: periodId })
  throwIfError(error)
  return data as number
}

export async function listPayrollPolicies() {
  const { data, error } = await supabase.from('pms_payroll_policies').select('*').order('effective_from', { ascending: false })
  throwIfError(error)
  return data ?? []
}

export async function createPayrollPolicy(values: { name: string; payroll_frequency: 'monthly' | 'semi_monthly' | 'special'; work_days_per_period: number; hours_per_day: number; overtime_multiplier: number; tardiness_deduction: boolean; undertime_deduction: boolean; rounding_mode: 'component_reconcile' | 'final_total' | 'component_only'; effective_from: string; effective_to?: string }) {
  const { data, error } = await supabase.from('pms_payroll_policies').insert({ ...values, effective_to: values.effective_to || null, is_active: true }).select().single()
  throwIfError(error)
  return data
}

export async function listStatutorySchedules() {
  const { data, error } = await supabase.from('pms_statutory_rate_schedules').select('*').order('effective_from', { ascending: false })
  throwIfError(error)
  return data ?? []
}

export async function createStatutorySchedule(values: { schedule_type: 'sss' | 'philhealth' | 'pagibig' | 'withholding_tax'; calculation_type: 'percentage' | 'fixed' | 'bracket'; employee_rate?: number; employee_amount?: number; parameters?: Record<string, unknown>; source_url?: string; source_reference?: string; effective_from: string; effective_to?: string; status: 'draft' | 'approved' }) {
  const parameters = values.calculation_type === 'percentage' ? { employee_rate: values.employee_rate ?? 0 } : values.calculation_type === 'fixed' ? { employee_amount: values.employee_amount ?? 0 } : (values.parameters ?? {})
  const { data, error } = await supabase.from('pms_statutory_rate_schedules').insert({ schedule_type: values.schedule_type, calculation_type: values.calculation_type, parameters, source_url: values.source_url || null, source_reference: values.source_reference || null, effective_from: values.effective_from, effective_to: values.effective_to || null, status: values.status }).select().single()
  throwIfError(error)
  return data
}

export async function updateStatutoryScheduleStatus(id: string, status: 'draft' | 'approved' | 'retired') {
  const { data, error } = await supabase.from('pms_statutory_rate_schedules').update({ status }).eq('id', id).select().single()
  throwIfError(error)
  return data
}

export async function listProfileChangeRequests(status?: string) {
  let query = supabase.from('pms_profile_change_requests').select('*, employee:pms_employees(id,employee_number,first_name,last_name)').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  throwIfError(error)
  return (data ?? []) as ProfileChangeRequest[]
}

export async function createProfileChangeRequest(employeeId: string, requestedChanges: Record<string, unknown>, reason?: string) {
  const { data, error } = await supabase.from('pms_profile_change_requests').insert({ employee_id: employeeId, requested_changes: requestedChanges, reason: reason || null }).select().single()
  throwIfError(error)
  return data as ProfileChangeRequest
}

export async function reviewProfileChangeRequest(id: string, status: 'approved' | 'rejected') {
  const { data, error } = await supabase.rpc('pms_review_profile_change_request', { p_request_id: id, p_status: status })
  throwIfError(error)
  return data
}

export async function listNotifications(userId: string) {
  const { data, error } = await supabase.from('pms_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
  throwIfError(error)
  return (data ?? []) as Notification[]
}

export async function listPayslips() {
  const { data, error } = await supabase.from('pms_employee_payslips').select('*, payroll_record:pms_payroll_records(*), payroll_period:pms_payroll_periods(*)').order('published_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as EmployeePayslip[]
}

export async function getPayslipUrl(payslipId: string) {
  const { data, error } = await supabase.functions.invoke('payslip-download', { body: { payslip_id: payslipId } })
  if (error) throw new Error('The payslip could not be prepared.')
  if (!data?.url) throw new Error('The payslip service did not return a download link.')
  return data.url as string
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('pms_notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  throwIfError(error)
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [pms_employees, activeEmployees, pms_departments, pms_positions, activePayroll, pending, loans] = await Promise.all([
    supabase.from('pms_employees').select('id', { count: 'exact', head: true }),
    supabase.from('pms_employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('pms_departments').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('pms_positions').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('pms_payroll_periods').select('*').in('status', ['draft', 'processing', 'review']).order('start_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('pms_other_deductions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('pms_employee_loans').select('outstanding_balance').eq('status', 'active'),
  ])
  for (const response of [pms_employees, activeEmployees, pms_departments, pms_positions, activePayroll, pending, loans]) throwIfError(response.error)
  let payrollExpense = 0
  if (activePayroll.data?.id) {
    const { data: expenseRows, error: expenseError } = await supabase.from('pms_payroll_records').select('net_pay').eq('payroll_period_id', activePayroll.data.id)
    throwIfError(expenseError)
    payrollExpense = ((expenseRows ?? []) as Array<{ net_pay: number | string }>).reduce((sum, row) => sum + Number(row.net_pay || 0), 0)
  }
  const outstandingLoans = ((loans.data ?? []) as Array<{ outstanding_balance: number | string }>).reduce((sum, loan) => sum + Number(loan.outstanding_balance || 0), 0)
  return {
    totalEmployees: pms_employees.count ?? 0,
    activeEmployees: activeEmployees.count ?? 0,
    totalDepartments: pms_departments.count ?? 0,
    totalPositions: pms_positions.count ?? 0,
    activePayroll: activePayroll.data as PayrollPeriod | null,
    payrollExpense,
    pendingTransactions: pending.count ?? 0,
    outstandingLoans,
  }
}
