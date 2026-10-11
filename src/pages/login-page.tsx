import { FormEvent, useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}${name}`

export function LoginPage() {
  const { signIn, isLoading, isConfigured, session, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isLoading && session) navigate(role === 'admin' ? '/admin' : '/employee', { replace: true })
  }, [isLoading, session, role, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await signIn(employeeNumber, password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from || '/admin', { replace: true })
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Invalid credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute -bottom-40 -right-20 h-[32rem] w-[32rem] rounded-full bg-cyan-700/20 blur-3xl" />
      <div className="relative mx-auto grid min-h-screen w-full max-w-[90rem] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 bg-gradient-to-br from-slate-950 via-emerald-950/80 to-slate-950 lg:flex">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:4rem_4rem]" />
          <div className="absolute -right-24 top-24 h-80 w-80 rounded-full border border-emerald-300/20" />
          <div className="absolute -right-10 top-40 h-64 w-64 rounded-full border border-cyan-300/10 rotate-45" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-16">
            <div>
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-32 items-center justify-center">
                  <div className="absolute inset-1 rotate-[-7deg] border border-emerald-300/30 bg-emerald-300/5 backdrop-blur-sm" />
                  <img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="relative h-14 w-28 object-contain" />
                </div>
                <div><div className="text-lg font-black tracking-tight">Paynexus PMS</div><div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">People. Pay. Progress.</div></div>
              </div>
              <div className="mt-20 grid max-w-2xl gap-10 xl:grid-cols-[0.75fr_1fr] xl:items-center">
                <div className="relative flex h-64 items-center justify-center">
                  <div className="absolute h-52 w-52 rotate-12 border border-emerald-200/25 bg-white/[0.02] backdrop-blur-sm" />
                  <div className="absolute h-44 w-44 -rotate-12 border border-cyan-200/20 bg-cyan-200/[0.04] backdrop-blur-md" />
                  <div className="relative z-10 flex h-44 w-44 items-center justify-center border border-white/20 bg-white/[0.08] shadow-2xl backdrop-blur-xl">
                    <img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-28 w-36 object-contain" />
                  </div>
                  <div className="absolute bottom-0 right-0 border border-white/10 bg-slate-900/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200 backdrop-blur-md">Payroll operations</div>
                </div>
                <div className="max-w-xl"><p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-300">Secure payroll operations</p><h1 className="mt-5 text-5xl font-black leading-[1.05] tracking-tight xl:text-6xl">A clearer way to manage every payday.</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">One trusted workspace for employee records, attendance, payroll review, and published payslips.</p></div>
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm text-slate-500"><span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300" />Protected by role-based access</span><span>v1.0</span></div>
          </div>
        </section>
        <section className="flex items-center justify-center bg-slate-900/30 p-5 sm:p-10">
          <Card className="w-full max-w-md border-white/10 bg-white/[0.06] p-7 text-white shadow-2xl backdrop-blur-xl sm:p-9">
            <div className="mb-8 lg:hidden"><div className="flex items-center gap-3"><img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-12 w-20 object-contain" /><div><div className="font-black">Paynexus PMS</div><div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Secure portal</div></div></div></div>
            <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">Welcome back</p><h2 className="mt-3 text-3xl font-black tracking-tight">Sign in to continue</h2><p className="mt-2 text-sm text-slate-400">Use your employee number and password.</p></div>
            {!isConfigured && <Alert variant="warning" className="mt-6 border-amber-400/30 bg-amber-400/10 text-amber-100">PMS is not configured in this environment. Contact the PMS administrator.</Alert>}
            {error && <Alert variant="danger" className="mt-6 border-red-400/30 bg-red-400/10 text-red-100">{error}</Alert>}
            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div><Label className="text-slate-400">Employee number</Label><div className="relative"><UserRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 text-white placeholder:text-slate-500" placeholder="26-00001" autoComplete="username" required /></div></div>
              <div><div className="flex items-center justify-between"><Label className="text-slate-400">Password</Label><span className="text-xs text-slate-500">Need help? Contact an administrator.</span></div><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="border-white/10 bg-white/[0.06] pl-10 pr-10 text-white placeholder:text-slate-500" placeholder="Enter your password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-2.5 text-slate-500 hover:text-white" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
              <Button type="submit" disabled={isSubmitting || isLoading} className="h-12 w-full bg-emerald-300 font-bold text-slate-950 hover:bg-emerald-200">{isSubmitting ? 'Signing in...' : <span className="flex items-center justify-center gap-2">Sign in <ArrowRight className="h-4 w-4" /></span>}</Button>
            </form>
            <p className="mt-7 text-center text-xs leading-5 text-slate-500">Your employee number and password are managed by your payroll administrator.</p>
          </Card>
        </section>
      </div>
    </div>
  )
}
