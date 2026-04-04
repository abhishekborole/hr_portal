import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users } from 'lucide-react'

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'))
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const EmployeesPage = lazy(() => import('@/pages/employees/EmployeesPage'))
const AttendancePage = lazy(() => import('@/pages/attendance/AttendancePage'))
const LeavesPage = lazy(() => import('@/pages/leaves/LeavesPage'))
const PayrollPage = lazy(() => import('@/pages/payroll/PayrollPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const ReimbursementsPage = lazy(() => import('@/pages/reimbursements/ReimbursementsPage'))
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'))
const TaxCalculatorPage = lazy(() => import('@/pages/tax/TaxCalculatorPage'))
const SalaryStructurePage = lazy(() => import('@/pages/salary/SalaryStructurePage'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function PageFallback() {
  return <div className="flex items-center justify-center h-64 text-sm text-gray-400">Loading…</div>
}

function LandingPage() {
  const [slug, setSlug] = useState('')
  const navigate = useNavigate()

  function handleGo(e: React.FormEvent) {
    e.preventDefault()
    const s = slug.trim().toLowerCase()
    if (s) navigate(`/${s}/login`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-5">
          <Users className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">HR Portal</h1>
        <p className="text-gray-500 mb-8">Multi-tenant HR management for your team</p>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Sign in to your company</p>
          <form onSubmit={handleGo} className="flex gap-2">
            <Input
              placeholder="your-company-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={!slug.trim()}>Go</Button>
          </form>
          <p className="text-xs text-gray-400 mt-2">Enter your company's URL identifier</p>
        </div>

        <p className="text-sm text-gray-500">
          New company?{' '}
          <a href="/register" className="text-blue-600 hover:underline font-medium">
            Start free trial
          </a>
        </p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/:slug/login" element={<LoginPage />} />

              <Route path="/:slug" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="employees" element={
                  <ProtectedRoute roles={['admin', 'manager']}><EmployeesPage /></ProtectedRoute>
                } />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="leaves" element={<LeavesPage />} />
                <Route path="payroll" element={<PayrollPage />} />
                <Route path="reimbursements" element={<ReimbursementsPage />} />
                <Route path="tax-calculator" element={<TaxCalculatorPage />} />
                <Route path="salary-structures" element={
                  <ProtectedRoute roles={['admin']}><SalaryStructurePage /></ProtectedRoute>
                } />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="reports" element={
                  <ProtectedRoute roles={['admin', 'manager']}><ReportsPage /></ProtectedRoute>
                } />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
