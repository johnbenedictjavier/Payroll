import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  Bell,
  CircleDollarSign,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  Sun,
  UserRound,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { initials, cn, titleCase } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { listNotifications, markNotificationRead } from '@/services/api'
import type { Notification, Role } from '@/types/database'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard; end?: boolean }

const publicAsset = (name: string) => `${import.meta.env.BASE_URL}${name}`

const adminNav: NavItem[] = [
  { label: 'Home', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Employees', to: '/admin/employees', icon: Users },
  { label: 'Organization', to: '/admin/organization', icon: Building2 },
  { label: 'Payroll', to: '/admin/payroll', icon: ReceiptText },
  { label: 'Loans', to: '/admin/loans', icon: WalletCards },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
  { label: 'Attendance', to: '/admin/attendance', icon: ClipboardCheck },
  { label: 'Salaries', to: '/admin/salaries', icon: CircleDollarSign },
  { label: 'Transactions', to: '/admin/transactions', icon: ReceiptText },
]

const employeeNav: NavItem[] = [
  { label: 'Home', to: '/employee', icon: LayoutDashboard, end: true },
  { label: 'Attendance', to: '/employee/attendance', icon: ClipboardCheck },
  { label: 'Payroll', to: '/employee/payroll', icon: ReceiptText },
  { label: 'Payslips', to: '/employee/payslips', icon: FileBarChart },
  { label: 'Profile', to: '/employee/profile', icon: UserRound },
]

function navForRole(role: Role | null) { return role === 'admin' ? adminNav : employeeNav }

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role, profile, employee, user, signOut } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('pms-sidebar-collapsed') === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lcc-theme') === 'dark')
  const nav = navForRole(role)
  const mobileNav = role === 'admin'
    ? [adminNav[0], adminNav[1], adminNav[3], adminNav[5], { label: 'More', to: '/admin/more', icon: Menu }]
    : [employeeNav[0], employeeNav[1], employeeNav[2], employeeNav[3], { label: 'More', to: '/employee/more', icon: Menu }]
  const displayName = profile?.full_name || (employee ? `${employee.first_name} ${employee.last_name}`.trim() : user?.email || 'User')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('lcc-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => { localStorage.setItem('pms-sidebar-collapsed', collapsed ? 'true' : 'false') }, [collapsed])

  useEffect(() => {
    if (!user) return
    void listNotifications(user.id).then(setNotifications).catch(() => setNotifications([]))
  }, [user])

  useEffect(() => setMobileOpen(false), [location.pathname])

  async function handleSignOut() {
    if (!window.confirm('Are you sure you want to sign out of Paynexus PMS?')) return
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background">
       <aside className={cn('fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-gradient-to-b from-card via-card to-emerald-50/70 transition-all dark:to-emerald-950/20 lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
         <div className={cn('border-b', collapsed ? 'px-2 py-4' : 'px-4 py-4')}>
           <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
             <Link to={role === 'admin' ? '/admin' : '/employee'} className={cn('flex min-w-0 items-center gap-3', collapsed && 'justify-center')}>
              <img src={publicAsset('pms.png')} alt="Paynexus Payroll" className={cn('shrink-0 object-contain', collapsed ? 'h-11 w-11' : 'h-12 w-28')} />
             {!collapsed && <div className="min-w-0"><div className="truncate font-black tracking-tight">Paynexus PMS</div><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{role === 'admin' ? 'Admin portal' : 'Employee portal'}</div></div>}
             </Link>
             {!collapsed && <button onClick={() => setCollapsed(true)} className="hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:block" aria-label="Collapse sidebar"><PanelLeftClose className="h-4 w-4" /></button>}
           </div>
           {collapsed && <button onClick={() => setCollapsed(false)} className="mt-3 hidden w-full rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:block" aria-label="Expand sidebar"><PanelLeftOpen className="mx-auto h-4 w-4" /></button>}
            <div className={cn('mt-3 flex items-center gap-2', collapsed ? 'flex-col' : 'px-1')}><img src={publicAsset('ccte.png')} alt="CCTE" className={cn('object-contain', collapsed ? 'h-7 w-7' : 'h-8 w-8')} /><img src={publicAsset('lcc.png')} alt="Lipa City Colleges" className={cn('object-contain', collapsed ? 'h-7 w-7' : 'h-8 w-8')} />{!collapsed && <span className="text-[10px] font-semibold leading-tight text-muted-foreground">Lipa City Colleges<br />People operations</span>}</div>
         </div>
         <nav className="scrollbar-subtle flex min-h-0 flex-1 flex-col space-y-1 overflow-y-auto p-3">
          {!collapsed && <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>}
          {nav.map((item) => <NavItem key={item.to} item={item} collapsed={collapsed} />)}
          {!collapsed && <p className="px-3 pb-2 pt-8 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Account</p>}
          <NavItem item={{ label: 'Settings', to: role === 'admin' ? '/admin/settings' : '/employee/settings', icon: Settings }} collapsed={collapsed} />
        </nav>
        <div className="border-t p-3">
          <button onClick={handleSignOut} className={cn('flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm text-muted-foreground transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40', collapsed && 'justify-center')}>
            <LogOut className="h-4 w-4 shrink-0" />{!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r bg-card shadow-xl transition-transform lg:hidden', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="flex h-20 items-center justify-between border-b px-5">
             <div className="flex items-center gap-3"><img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-11 w-16 object-contain" /><div><div className="font-black">Paynexus PMS</div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{titleCase(role)} portal</div></div></div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button>
        </div>
          <nav className="scrollbar-subtle flex-1 space-y-1 overflow-y-auto p-3">{mobileNav.map((item) => <NavItem key={item.to} item={item} collapsed={false} />)}<NavItem item={{ label: 'Settings', to: role === 'admin' ? '/admin/settings' : '/employee/settings', icon: Settings }} collapsed={false} /></nav>
        <div className="border-t p-3"><button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-muted-foreground hover:bg-red-50 hover:text-red-700"><LogOut className="h-4 w-4" />Sign out</button></div>
      </aside>

      <main className={cn('min-h-screen transition-[padding] lg:pl-64', collapsed && 'lg:pl-[76px]')}>
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="flex items-center gap-2 font-black tracking-tight lg:hidden"><img src={publicAsset('pms.png')} alt="Paynexus Payroll" className="h-8 w-10 object-contain" />Paynexus PMS</div><div className="hidden text-sm text-muted-foreground lg:block">{role === 'admin' ? 'Administrator workspace' : 'Your payroll workspace'}</div></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDarkMode((value) => !value)} aria-label="Toggle theme">{darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowNotifications((value) => !value)} aria-label="Notifications"><Bell className="h-4 w-4" />{notifications.some((item) => !item.read_at) && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}</Button>
              {showNotifications && <NotificationPanel notifications={notifications} onRead={async (item) => { if (!item.read_at) { await markNotificationRead(item.id); setNotifications((all) => all.map((current) => current.id === item.id ? { ...current, read_at: new Date().toISOString() } : current)) } }} />}
            </div>
             <div className="relative ml-1">
               <button onClick={() => setShowUserMenu((value) => !value)} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 hover:bg-secondary"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials(displayName)}</div><div className="hidden text-left sm:block"><div className="max-w-32 truncate text-sm font-semibold">{displayName}</div><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{titleCase(role)}</div></div><ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" /></button>
               {showUserMenu && <Card className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-52 p-2"><Link className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary" to={role === 'admin' ? '/admin/settings' : '/employee/profile'} onClick={() => setShowUserMenu(false)}><UserRound className="h-4 w-4" />Account settings</Link><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleSignOut}><LogOut className="h-4 w-4" />Sign out</button></Card>}
            </div>
          </div>
        </header>
        <div className="p-4 pb-28 sm:p-6 lg:p-8 lg:pb-8">{children}</div>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card/95 px-2 pt-2 backdrop-blur lg:hidden">
        {mobileNav.map((item) => <NavItem key={item.to} item={item} mobile />)}
      </nav>
    </div>
  )
}

function NavItem({ item, collapsed = false, mobile = false }: { item: NavItem; collapsed?: boolean; mobile?: boolean }) {
  const Icon = item.icon
   return <NavLink end={item.end} to={item.to} title={collapsed ? item.label : undefined} className={({ isActive }) => cn('group flex items-center gap-3 rounded-xl text-sm font-semibold transition', mobile ? 'min-w-0 flex-col gap-1 px-1 py-1.5 text-[10px]' : 'px-3 py-2.5', isActive ? 'bg-gradient-to-r from-primary/15 to-cyan-500/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground', collapsed && 'justify-center px-2')}><Icon className={cn('h-4 w-4 shrink-0', mobile && 'h-5 w-5')} />{!collapsed && <span className={cn('truncate', mobile && 'max-w-full')}>{item.label}</span>}</NavLink>
}

function NotificationPanel({ notifications, onRead }: { notifications: Notification[]; onRead: (notification: Notification) => void }) {
  return <Card className="fixed right-4 top-[5.25rem] z-50 w-[min(22rem,calc(100vw-2rem))] p-2 sm:right-6 lg:right-8"><div className="flex items-center justify-between px-3 py-2"><span className="font-bold">Notifications</span>{notifications.length > 0 && <Badge variant="muted">{notifications.length}</Badge>}</div>{notifications.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">You are all caught up.</p> : <div className="max-h-80 overflow-y-auto">{notifications.map((notification) => <button key={notification.id} onClick={() => onRead(notification)} className={cn('w-full rounded-lg px-3 py-3 text-left hover:bg-secondary', !notification.read_at && 'bg-primary/5')}><div className="flex items-start gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><div className="text-sm font-semibold">{notification.title}</div><p className="mt-0.5 text-xs text-muted-foreground">{notification.message}</p></div></div></button>)}</div>}</Card>
}
