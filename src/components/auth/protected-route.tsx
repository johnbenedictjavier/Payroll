import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Skeleton } from '@/components/ui/skeleton'
import type { Role } from '@/types/database'
import { homePathForRole } from '@/lib/auth'
import { NexMascot } from '@/components/brand/nex-mascot'

export function ProtectedRoute({ role }: { role?: Role }) {
  const { session, isLoading, isConfigured, role: currentRole, employee, identityError } = useAuth()
  const location = useLocation()
  if (isLoading) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6"><NexMascot size="md" /><Skeleton className="h-2 w-48" /><p className="text-sm font-semibold text-muted-foreground">Restoring your secure workspace...</p></div>
  const from = `${location.pathname}${location.search}`
  if (!isConfigured) return <Navigate to="/login" replace state={{ from }} />
  if (!session) return <Navigate to="/login" replace state={{ from }} />
  if (identityError || !currentRole) return <Navigate to="/login" replace state={{ from, message: identityError }} />
  if (role && currentRole !== role) return <Navigate to={homePathForRole(currentRole)} replace />
  if (currentRole === 'employee' && employee?.must_change_password && location.pathname !== '/employee/settings') return <Navigate to="/employee/settings?firstLogin=1" replace />
  return <Outlet />
}
