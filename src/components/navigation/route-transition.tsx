import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { Role } from '@/types/database'
import { NexMascot } from '@/components/brand/nex-mascot'

type RouteTransitionContextValue = { start: (role?: Role | null, message?: string) => void; finish: () => void }
const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null)

export function RouteTransitionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ active: boolean; role?: Role | null; message: string }>({ active: false, message: 'Opening your workspace' })
  const timer = useRef<number | null>(null)

  const finish = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setState((current) => ({ ...current, active: false }))
  }, [])

  const start = useCallback((role?: Role | null, message = 'Opening your workspace') => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setState({ active: true, role, message })
    timer.current = window.setTimeout(() => setState((current) => ({ ...current, active: false })), 900)
  }, [])

  return <RouteTransitionContext.Provider value={{ start, finish }}>
    {children}
    {state.active && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-6 text-white backdrop-blur-md motion-safe:animate-page-in" role="status" aria-live="polite"><div className="flex w-full max-w-sm flex-col items-center text-center"><NexMascot size="lg" className="mb-2" /><div className="section-kicker text-cyan-300">{state.role === 'admin' ? 'Administrator workspace' : state.role === 'employee' ? 'Employee workspace' : 'PayNexus PMS'}</div><p className="mt-3 text-xl font-bold tracking-tight">{state.message}</p><div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full w-1/2 animate-route-progress rounded-full bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400" /></div></div></div>}
  </RouteTransitionContext.Provider>
}

export function useRouteTransition() {
  const context = useContext(RouteTransitionContext)
  if (!context) throw new Error('useRouteTransition must be used inside RouteTransitionProvider')
  return context
}
