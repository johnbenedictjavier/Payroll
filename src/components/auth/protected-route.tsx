import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types/database'
import { homePathForRole } from '@/lib/auth'

export function ProtectedRoute({ role }: { role?: Role }) {
  const { session, isLoading, isConfigured, role: currentRole, employee, identityError } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="flex min-h-screen items-center justify-center p-6"><Skeleton className="h-24 w-full max-w-md" /></div>
  const from = `${location.pathname}${location.search}`
  if (!isConfigured) return <Navigate to="/login" replace state={{ from }} />
  if (!session) return <Navigate to="/login" replace state={{ from }} />
  if (identityError || !currentRole) return <Navigate to="/login" replace state={{ from, message: identityError }} />
  if (role && currentRole !== role) return <Navigate to={homePathForRole(currentRole)} replace />
  if (currentRole === 'employee' && employee?.must_change_password && location.pathname !== '/employee/settings') return <Navigate to="/employee/settings?firstLogin=1" replace />
  return <Outlet />
}
