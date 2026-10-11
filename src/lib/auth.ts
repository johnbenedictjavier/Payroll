import type { Role } from '@/types/database'

export function homePathForRole(role: Role) {
  return role === 'admin' ? '/admin' : '/employee'
}

export function canRoleAccessPath(pathname: string, role: Role) {
  return role === 'admin' ? pathname.startsWith('/admin') : pathname.startsWith('/employee')
}
