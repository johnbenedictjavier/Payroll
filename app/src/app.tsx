import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/contexts/auth-context'
import { LoginPage } from '@/pages/login-page'
import { AdminDashboardPage } from '@/pages/admin-dashboard-page'
import { EmployeeDashboardPage } from '@/pages/employee-dashboard-page'
import { EmployeesPage } from '@/pages/employees-page'
import { EmployeeProfilePage as AdminEmployeeProfilePage } from '@/pages/employee-profile-page'
import { OrganizationPage } from '@/pages/organization-page'
import { PayrollPage } from '@/pages/payroll-page'
import { AttendancePage } from '@/pages/attendance-page'
import { LoansPage } from '@/pages/loans-page'
import { ReportsPage } from '@/pages/reports-page'
import { EmployeeAttendancePage, EmployeePayrollPage, EmployeePayslipsPage, EmployeeProfilePage, SettingsPage } from '@/pages/employee-portal-pages'
import { AdminSettingsPage } from '@/pages/admin-settings-page'
import { MorePage } from '@/pages/more-page'
import { SalariesPage } from '@/pages/salaries-page'
import { TransactionsPage } from '@/pages/transactions-page'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'

export function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedRoute />}><Route element={<ShellLayout />}><Route path="/" element={<HomeRedirect />} /><Route element={<ProtectedRoute role="admin" />}><Route path="/admin" element={<AdminDashboardPage />} /><Route path="/admin/employees" element={<EmployeesPage />} /><Route path="/admin/employees/new" element={<AdminEmployeeProfilePage />} /><Route path="/admin/employees/:id" element={<AdminEmployeeProfilePage />} /><Route path="/admin/organization" element={<OrganizationPage />} /><Route path="/admin/payroll" element={<PayrollPage />} /><Route path="/admin/attendance" element={<AttendancePage />} /><Route path="/admin/loans" element={<LoansPage />} /><Route path="/admin/salaries" element={<SalariesPage />} /><Route path="/admin/transactions" element={<TransactionsPage />} /><Route path="/admin/reports" element={<ReportsPage />} /><Route path="/admin/settings" element={<AdminSettingsPage />} /><Route path="/admin/more" element={<MorePage />} /></Route><Route element={<ProtectedRoute role="employee" />}><Route path="/employee" element={<EmployeeDashboardPage />} /><Route path="/employee/attendance" element={<EmployeeAttendancePage />} /><Route path="/employee/payroll" element={<EmployeePayrollPage />} /><Route path="/employee/payslips" element={<EmployeePayslipsPage />} /><Route path="/employee/profile" element={<EmployeeProfilePage />} /><Route path="/employee/settings" element={<SettingsPage />} /><Route path="/employee/more" element={<MorePage />} /></Route><Route path="*" element={<NotFound />} /></Route></Route></Routes>
}

function ShellLayout() { return <AppShell><Outlet /></AppShell> }

function HomeRedirect() { const { role } = useAuth(); return <Navigate to={role === 'admin' ? '/admin' : '/employee'} replace /> }

function NotFound() { return <div className="flex min-h-[60vh] items-center justify-center"><EmptyState title="Page not found" description="The page you requested does not exist." action={<Button onClick={() => window.history.back()}>Go back</Button>} /></div> }
