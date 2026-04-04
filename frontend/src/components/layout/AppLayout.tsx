import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { notificationApi } from '@/lib/api'
import {
  LayoutDashboard, Users, CalendarCheck, FileText,
  DollarSign, BarChart3, LogOut, ChevronRight,
  Receipt, Calculator, UserCircle, Bell, Layers,
} from 'lucide-react'
import type { Notification } from '@/types'

const navItems = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'] },
  { path: 'employees', label: 'Employees', icon: Users, roles: ['admin', 'manager'] },
  { path: 'attendance', label: 'Attendance', icon: CalendarCheck, roles: ['admin', 'manager', 'employee'] },
  { path: 'leaves', label: 'Leaves', icon: FileText, roles: ['admin', 'manager', 'employee'] },
  { path: 'payroll', label: 'Payroll', icon: DollarSign, roles: ['admin', 'manager', 'employee'] },
  { path: 'reimbursements', label: 'Reimbursements', icon: Receipt, roles: ['admin', 'manager', 'employee'] },
  { path: 'salary-structures', label: 'Salary Structures', icon: Layers, roles: ['admin'] },
  { path: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'manager'] },
  { path: 'tax-calculator', label: 'Tax Calculator', icon: Calculator, roles: ['admin', 'manager', 'employee'] },
  { path: 'profile', label: 'My Profile', icon: UserCircle, roles: ['employee'] },
]

function NotificationBell({ slug: _slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationApi.list,
    refetchInterval: 30_000,
  })

  const markAllMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const unread = notifications.filter((n) => !n.is_read).length

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function typeColor(type: string) {
    const map: Record<string, string> = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
    }
    return map[type] ?? 'bg-gray-400'
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                className="text-xs text-blue-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 ${n.is_read ? '' : 'bg-blue-50/50'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${typeColor(n.notif_type)}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                      {n.message && <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  const visibleItems = navItems.filter((item) => user && item.roles.includes(user.role))

  function handleLogout() {
    logout()
    navigate(`/${slug}/login`)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#1e3a5f] flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-white text-sm block truncate">HR Portal</span>
              <span className="text-xs text-blue-300 font-mono truncate block">{slug}</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={`/${slug}/${path}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 mb-1">
            <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white uppercase">
                {user?.username?.[0] ?? 'U'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-blue-300 capitalize">{user?.role}</p>
            </div>
            <NotificationBell slug={slug ?? ''} />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-blue-200 hover:bg-white/10 hover:text-white transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5" />}
          <span className={i === items.length - 1 ? 'text-gray-900 font-medium' : ''}>{item}</span>
        </span>
      ))}
    </nav>
  )
}
