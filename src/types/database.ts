export type Role = 'admin' | 'employee'
export type EmploymentStatus = 'active' | 'inactive' | 'on_leave' | 'terminated'
export type PayrollStatus = 'draft' | 'processing' | 'review' | 'finalized' | 'paid' | 'cancelled'
export type SalaryType = 'monthly' | 'daily' | 'hourly'
export type LoanStatus = 'active' | 'completed' | 'suspended' | 'cancelled'
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  avatar_path: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  auth_user_id: string | null
  legacy_employee_id: number | null
  employee_number: string
  first_name: string
  middle_name: string | null
  last_name: string
  gender: string | null
  email: string | null
  civil_status: string | null
  nationality: string | null
  religion: string | null
  birth_date: string | null
  permanent_address: string | null
  present_address: string | null
  contact_number: string | null
  photo_path: string | null
  legacy_photo_path?: string | null
  email_duplicate?: boolean
  must_change_password: boolean
  password_changed_at?: string | null
  status: EmploymentStatus
  created_at: string
  updated_at: string
  department?: Pick<Department, 'id' | 'name'> | null
  position?: Pick<Position, 'id' | 'name'> | null
}

export interface Department {
  id: string
  legacy_department_id: number | null
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  employee_count?: number
}

export interface Position {
  id: string
  legacy_position_id: number | null
  department_id: string | null
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  employee_count?: number
  department?: Pick<Department, 'id' | 'name'> | null
}

export interface EmployeeAssignment {
  id: string
  employee_id: string
  department_id: string | null
  position_id: string | null
  start_date: string
  end_date: string | null
  is_primary: boolean
  legacy_assignment_id: number | null
  department?: Pick<Department, 'id' | 'name'> | null
  position?: Pick<Position, 'id' | 'name'> | null
}

export interface EmergencyContact {
  id?: string
  employee_id?: string
  name: string
  relationship: string
  address: string
  contact: string
}

export interface Dependent {
  id?: string
  employee_id?: string
  name: string
  birth_date: string
  relationship: string
}

export interface EducationalBackground {
  id?: string
  employee_id?: string
  level: string
  school: string
  address: string
  school_year: string
}

export interface CharacterReference {
  id?: string
  employee_id?: string
  name: string
  occupation: string
  address: string
  contact: string
}

export interface EmployeeIdentifier {
  id?: string
  employee_id?: string
  identifier_type: string
  identifier_value: string
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  storage_path: string
  original_name: string
  document_type: string
  parser_version: string
  uploaded_by: string | null
  created_at: string
}

export interface EmployeeProfileData {
  employee: Employee
  emergency_contacts: EmergencyContact[]
  dependents: Dependent[]
  educational_backgrounds: EducationalBackground[]
  character_references: CharacterReference[]
  identifiers: EmployeeIdentifier[]
  assignments: EmployeeAssignment[]
  salary_history: SalaryHistory[]
  documents: EmployeeDocument[]
}

export interface EmployeeProfilePayload {
  employee: Partial<Employee> & {
    first_name: string
    last_name: string
    current_department_id?: string | null
    current_position_id?: string | null
  }
  emergency_contacts: EmergencyContact[]
  dependents: Dependent[]
  educational_backgrounds: EducationalBackground[]
  character_references: CharacterReference[]
  identifiers: EmployeeIdentifier[]
  assignments: Array<Partial<EmployeeAssignment> & {
    department_id: string
    position_id: string
    start_date: string
  }>
  salary_history: Array<Partial<SalaryHistory> & {
    salary_type: SalaryType
    amount: number
    effective_from: string
  }>
  salary_history_removals?: Array<{
    id: string
    updated_at: string
  }>
}

export interface SalaryHistory {
  id: string
  employee_id: string
  assignment_id: string | null
  salary_type: SalaryType
  amount: number
  is_approved: boolean
  effective_from: string
  effective_to: string | null
  source: string | null
  created_at: string
  updated_at: string
}

export interface PayrollPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  pay_date: string
  frequency: 'monthly' | 'semi_monthly' | 'special'
  status: PayrollStatus
  finalized_at: string | null
  paid_at: string | null
  created_at: string
}

export interface Attendance {
  id: string
  payroll_period_id: string
  employee_id: string
  days_worked: number
  absence_days: number
  tardiness_minutes: number
  undertime_minutes: number
  overtime_hours: number
  notes: string | null
  created_at: string
  updated_at: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'photo_path'>
}

export interface LoanType {
  id: string
  name: string
  description: string | null
  default_terms: number | null
  is_active: boolean
}

export interface EmployeeLoan {
  id: string
  employee_id: string
  loan_type_id: string
  loan_date: string
  principal_amount: number
  repayment_terms: number
  installment_amount: number
  outstanding_balance: number
  priority: number | null
  status: LoanStatus
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'photo_path'>
  loan_type?: Pick<LoanType, 'id' | 'name'>
}

export interface OtherTransaction {
  id: string
  payroll_period_id: string
  employee_id: string
  transaction_type: string
  amount: number
  description: string | null
  status: RequestStatus | 'approved' | 'pending'
  created_at: string
  updated_at?: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'photo_path'>
}

export interface PayrollRecordItem {
  id?: string
  payroll_record_id?: string
  item_type: 'earning' | 'deduction' | 'contribution' | 'tax' | 'loan'
  code: string
  label: string
  amount: number
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface PayrollAttendanceSnapshot {
  days_worked: number
  absence_days: number
  tardiness_minutes: number
  undertime_minutes: number
  overtime_hours: number
  notes?: string | null
}

export interface PayrollRecord {
  id: string
  payroll_period_id: string
  employee_id: string
  salary_type: SalaryType
  base_pay: number
  attendance_deductions: number
  basic_pay: number
  overtime_pay: number
  other_income: number
  gross_pay: number
  employee_contributions: number
  employer_contributions: number
  withholding_tax: number
  loan_deductions: number
  other_deductions: number
  total_deductions: number
  net_pay: number
  calculation_version: string
  calculation_snapshot?: Record<string, unknown>
  created_at: string
  attendance?: Attendance | PayrollAttendanceSnapshot | null
  items?: PayrollRecordItem[]
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'photo_path'>
}

export interface ProfileChangeRequest {
  id: string
  employee_id: string
  requested_changes: Record<string, unknown>
  reason: string | null
  status: RequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  employee?: Pick<Employee, 'id' | 'employee_number' | 'first_name' | 'last_name' | 'photo_path'>
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  read_at: string | null
  created_at: string
}

export interface EmployeePayslip {
  id: string
  employee_id: string
  payroll_record_id: string
  storage_path: string | null
  published_at: string | null
  created_at: string
  payroll_record?: PayrollRecord
  payroll_period?: PayrollPeriod
}

export interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  totalDepartments: number
  totalPositions: number
  activePayroll: PayrollPeriod | null
  payrollExpense: number
  pendingTransactions: number
  outstandingLoans: number
}

export interface StatutoryStatus {
  schedule_type: 'sss' | 'philhealth' | 'pagibig' | 'withholding_tax'
  status: 'RECORDED' | 'NEEDED'
  effective_from: string | null
  source_reference: string | null
  source_url: string | null
}
