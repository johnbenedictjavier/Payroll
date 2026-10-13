import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { BrandLockup } from '@/components/brand/brand-lockup'
import { NexMascot } from '@/components/brand/nex-mascot'
import { TypingWords } from '@/components/brand/typing-words'
import { useRouteTransition } from '@/components/navigation/route-transition'
import { canRoleAccessPath, homePathForRole } from '@/lib/auth'

export function LoginPage() {
  const { signIn, isLoading, isConfigured, session, role, identityError } = useAuth()
  const { start } = useRouteTransition()
  const navigate = useNavigate()
  const location = useLocation()
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && session && role && !isSubmitting) navigate(homePathForRole(role), { replace: true })
  }, [isLoading, session, role, isSubmitting, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const signedInRole = await signIn(employeeNumber, password)
      const from = (location.state as { from?: string } | null)?.from
      const destination = from && canRoleAccessPath(from.split('?')[0], signedInRole) ? from : homePathForRole(signedInRole)
      start(signedInRole, signedInRole === 'admin' ? 'Opening the admin desk' : 'Opening your employee wallet')
      navigate(destination, { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Invalid credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="login-viewport relative h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#071719] text-white">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_90%_85%,rgba(14,165,233,0.12),transparent_30%)]" />
    <div className="absolute left-5 top-5 z-20 sm:left-8 sm:top-7 lg:left-12 lg:top-8"><BrandLockup display="login" inverse /></div>
      <div className="relative mx-auto grid h-full w-full max-w-[96rem] min-h-0 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden min-h-0 overflow-hidden border-r border-white/10 lg:flex">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:4rem_4rem]" />
          <div className="relative z-10 flex h-full w-full flex-col justify-between px-12 pb-12 pt-32 xl:px-20">
            <div className="max-w-2xl">
              <div className="section-kicker text-emerald-300">A quieter payroll desk</div>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-[1.04] tracking-[-0.045em] text-white xl:text-6xl">Payroll work,<br />made clearer.</h1>
              <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-500">A better rhythm for</span>
                <span className="inline-flex min-h-9 items-center rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 font-semibold text-emerald-200"><TypingWords className="text-emerald-200" /></span>
              </div>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">A focused workspace for people records, attendance, payroll review, and the small decisions that keep payday on track.</p>
            </div>
            <div className="relative mt-10 flex items-end justify-between gap-6 border-t border-white/10 pt-6">
              <div className="max-w-sm">
                <div className="section-kicker text-cyan-300">PayNexus PMS</div>
                <div className="mt-3 text-2xl font-bold tracking-tight">Less noise. Better decisions.</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-300" />Role-based access · Clear approvals</div>
              </div>
              <NexMascot size="lg" className="-mb-8 -mr-4" />
            </div>
          </div>
        </section>
      <section className="flex min-h-0 h-full items-center justify-center px-4 pb-5 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pt-24">
        <Card className="relative isolate w-full max-w-md overflow-hidden border-white/10 bg-white/[0.075] p-5 text-white shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7 motion-safe:animate-page-in">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
            <img src={`${import.meta.env.BASE_URL}assets/ccte.png`} alt="" className="absolute -right-8 -top-8 h-40 w-40 object-contain opacity-[0.09] grayscale" />
            <img src={`${import.meta.env.BASE_URL}assets/lcc.png`} alt="" className="absolute -bottom-14 right-16 h-36 w-36 object-contain opacity-[0.09] grayscale" />
          </div>
          <div className="relative z-10">
            <div><div className="section-kicker text-emerald-300">Welcome back</div><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-slate-400">Use your employee number and password to open your payroll workspace.</p></div>
            {!isConfigured && <Alert variant="warning" className="mt-5 border-amber-400/30 bg-amber-400/10 text-amber-100">PMS is not configured in this environment. Contact the PMS administrator.</Alert>}
            {(error || identityError) && <Alert role="alert" variant="danger" className="mt-5 border-red-400/30 bg-red-400/10 text-red-100">{error || identityError}</Alert>}
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div><Label htmlFor="login-employee-number" className="text-slate-400">Employee number</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input id="login-employee-number" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 text-white placeholder:text-slate-500 focus:bg-white/[0.1]" placeholder="26-00001" autoComplete="username" required /></div></div>
              <div><div className="flex items-center justify-between gap-3"><Label htmlFor="login-password" className="text-slate-400">Password</Label><span className="text-right text-[11px] text-slate-500">Need help? Contact an administrator.</span></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 pr-10 text-white placeholder:text-slate-500 focus:bg-white/[0.1]" placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 rounded-md p-1 text-slate-500 transition hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <Button type="submit" loading={isSubmitting || isLoading} loadingLabel="Signing in..." className="h-11 w-full"><span className="flex items-center justify-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span></Button>
            </form>
            <div className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />Your employee number and password are managed by your payroll administrator.</div>
          </div>
        </Card>
      </section>
    </div>
  </div>
}
