import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types/database'

export function ProtectedRoute({ role }: { role?: Role }) {
  const { session, isLoading, isConfigured, role: currentRole, employee } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="flex min-h-screen items-center justify-center p-6"><Skeleton className="h-24 w-full max-w-md" /></div>
  if (!isConfigured) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && currentRole !== role) return <Navigate to={currentRole === 'admin' ? '/admin' : '/employee'} replace />
  if (currentRole === 'employee' && employee?.must_change_password && location.pathname !== '/employee/settings') return <Navigate to="/employee/settings?firstLogin=1" replace />
  return <Outlet />
}
