import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { canRoleAccessPath, homePathForRole } from '@/lib/auth'

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}${name}`

export function LoginPage() {
  const { signIn, isLoading, isConfigured, session, role, identityError } = useAuth()
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
      navigate(destination, { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Invalid credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
    <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-3xl motion-safe:animate-float-slow" />
    <div className="pointer-events-none absolute -bottom-48 -right-24 h-[34rem] w-[34rem] rounded-full bg-cyan-600/20 blur-3xl motion-safe:animate-float-slow [animation-delay:1.5s]" />
    <div className="absolute left-5 top-5 z-20 flex items-center gap-3 sm:left-8 sm:top-7 lg:left-12 lg:top-9"><div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-lg"><img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-16 w-16 max-w-none object-contain" /></div><div><div className="font-bold tracking-tight">Paynexus PMS</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">People operations</div></div></div>
    <div className="relative mx-auto grid min-h-screen w-full max-w-[96rem] lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-white/10 lg:flex">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:4rem_4rem]" />
        <div className="relative z-10 flex w-full flex-col justify-center px-12 pb-14 pt-36 xl:px-20">
          <div className="max-w-2xl"><div className="section-kicker text-emerald-300">Secure payroll operations</div><h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight tracking-[-0.04em] text-white xl:text-5xl">A calmer way to move every payday forward.</h1><p className="mt-5 max-w-lg text-base leading-7 text-slate-400">One trusted workspace for employee records, attendance, payroll review, and published payslips.</p></div>
          <div className="relative mt-12 h-64 max-w-xl [perspective:1100px]">
            <div className="absolute left-8 top-4 h-44 w-[22rem] -rotate-[8deg] rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-sm sm:left-16" />
            <div className="absolute left-16 top-10 h-44 w-[22rem] rotate-[5deg] rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] shadow-2xl backdrop-blur-md sm:left-24" />
            <div className="absolute left-10 top-20 w-[min(25rem,calc(100%-2rem))] rounded-2xl border border-emerald-200/30 bg-gradient-to-br from-emerald-400/30 via-teal-500/20 to-slate-900/80 p-5 shadow-2xl shadow-emerald-950/50 transform-gpu transition-transform duration-500 hover:rotate-[-2deg] hover:scale-[1.02] sm:left-20"><div className="flex items-center justify-between"><div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Payroll wallet</div><Sparkles className="h-5 w-5 text-emerald-200" /></div><div className="mt-8 text-3xl font-bold tracking-tight">Ready for payday</div><div className="mt-3 flex items-center gap-2 text-xs text-slate-300"><span className="h-2 w-2 rounded-full bg-emerald-300" />Controlled access · Clear approvals</div></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-400"><span className="rounded-full border border-white/10 px-3 py-1.5">People</span><span className="rounded-full border border-white/10 px-3 py-1.5">Pay</span><span className="rounded-full border border-white/10 px-3 py-1.5">Progress</span></div>
          <div className="mt-12 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-300" />Protected by role-based access</div>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-slate-900/30 px-4 pb-10 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pt-24">
        <Card className="w-full max-w-md border-white/10 bg-white/[0.07] p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8 motion-safe:animate-page-in">
          <div><div className="section-kicker text-emerald-300">Welcome back</div><h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Sign in to continue</h2><p className="mt-2 text-sm leading-6 text-slate-400">Use your employee number and password to open your payroll workspace.</p></div>
          {!isConfigured && <Alert variant="warning" className="mt-6 border-amber-400/30 bg-amber-400/10 text-amber-100">PMS is not configured in this environment. Contact the PMS administrator.</Alert>}
          {(error || identityError) && <Alert role="alert" variant="danger" className="mt-6 border-red-400/30 bg-red-400/10 text-red-100">{error || identityError}</Alert>}
          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
            <div><Label htmlFor="login-employee-number" className="text-slate-400">Employee number</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input id="login-employee-number" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 text-white placeholder:text-slate-500 focus:bg-white/[0.1]" placeholder="26-00001" autoComplete="username" required /></div></div>
            <div><div className="flex items-center justify-between"><Label htmlFor="login-password" className="text-slate-400">Password</Label><span className="text-xs text-slate-500">Need help? Contact an administrator.</span></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 pr-10 text-white placeholder:text-slate-500 focus:bg-white/[0.1]" placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 rounded-md p-1 text-slate-500 transition hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
            <Button type="submit" loading={isSubmitting || isLoading} loadingLabel="Signing in..." className="h-12 w-full">{<span className="flex items-center justify-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}</Button>
          </form>
          <p className="mt-7 text-center text-xs leading-5 text-slate-500">Your employee number and password are managed by your payroll administrator.</p>
        </Card>
      </section>
    </div>
  </div>
}
