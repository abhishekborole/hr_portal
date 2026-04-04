import { useQuery } from '@tanstack/react-query'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { employeeApi, leaveApi, payrollApi, attendanceApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/AppLayout'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Users, UserCheck, Clock, DollarSign } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const now = new Date()
// Use previous month for payroll/attendance data (current month rarely has full data)
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
const currentMonth = prevMonth.getMonth() + 1
const currentYear = prevMonth.getFullYear()

export default function DashboardPage() {
  const { user, isAdmin, isManager } = useAuth()

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', { is_active: true }],
    queryFn: () => employeeApi.list({ is_active: true }),
    enabled: isAdmin || isManager,
  })

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeeApi.list({ is_active: undefined }),
    enabled: isAdmin || isManager,
  })

  const { data: pendingLeaves = [] } = useQuery({
    queryKey: ['leaves-pending'],
    queryFn: () => leaveApi.list({ status: 'pending' }),
    enabled: isAdmin || isManager,
  })

  const { data: payrollData = [] } = useQuery({
    queryKey: ['payroll', { month: currentMonth, year: currentYear }],
    queryFn: () => payrollApi.list({ month: currentMonth, year: currentYear }),
    enabled: isAdmin || isManager,
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: employeeApi.departments,
    enabled: isAdmin || isManager,
  })

  // Employee self-service queries
  const { data: mySummary } = useQuery({
    queryKey: ['my-attendance-summary', currentMonth, currentYear],
    queryFn: () => attendanceApi.summary(user!.employee_id!, currentMonth, currentYear),
    enabled: !isAdmin && !isManager && !!user?.employee_id,
  })

  const { data: myLeaves = [] } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => leaveApi.list(),
    enabled: !isAdmin && !isManager,
  })

  const { data: myPayroll = [] } = useQuery({
    queryKey: ['my-payroll'],
    queryFn: () => payrollApi.list(),
    enabled: !isAdmin && !isManager,
  })

  if (isAdmin || isManager) {
    // Group employees by dept
    const deptMap: Record<string, number> = {}
    employees.forEach((e) => {
      const name = departments.find((d) => d.id === e.department_id)?.name ?? 'Unassigned'
      deptMap[name] = (deptMap[name] || 0) + 1
    })
    const deptChartData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

    const payrollTotal = payrollData.reduce((sum, p) => sum + Number(p.net_salary), 0)
    const topPayroll = [...payrollData]
      .sort((a, b) => Number(b.net_salary) - Number(a.net_salary))
      .slice(0, 8)
      .map((p) => ({
        name: p.employee ? `${p.employee.first_name} ${p.employee.last_name}`.slice(0, 12) : `Emp#${p.employee_id}`,
        net: Number(p.net_salary),
      }))

    return (
      <div>
        <PageHeader title="Dashboard" subtitle={`Overview for ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Employees" value={allEmployees.length} sub={`${employees.length} active`} icon={Users} color="bg-blue-500" />
          <StatCard title="Active Employees" value={employees.length} icon={UserCheck} color="bg-green-500" />
          <StatCard title="Pending Leaves" value={pendingLeaves.length} sub="awaiting approval" icon={Clock} color="bg-yellow-500" />
          <StatCard title="Payroll Processed" value={payrollData.length} sub={`Net: ${formatCurrency(payrollTotal)}`} icon={DollarSign} color="bg-purple-500" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader><CardTitle>Employees by Department</CardTitle></CardHeader>
            <CardContent>
              {deptChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={deptChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {deptChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-10 text-center">No employee data</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Net Salaries — {new Date().toLocaleString('en-IN', { month: 'long' })}</CardTitle></CardHeader>
            <CardContent>
              {topPayroll.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topPayroll} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(v as number)} />
                    <Bar dataKey="net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-gray-400 py-10 text-center">No payroll data for this month</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Pending Leave Requests</CardTitle></CardHeader>
          <CardContent>
            {pendingLeaves.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No pending leaves</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Employee</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Type</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">From</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">To</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Days</th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.slice(0, 10).map((leave) => (
                      <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : `#${leave.employee_id}`}</td>
                        <td className="py-2 px-3"><Badge variant="secondary">{leave.leave_type}</Badge></td>
                        <td className="py-2 px-3 text-gray-600">{formatDate(leave.start_date)}</td>
                        <td className="py-2 px-3 text-gray-600">{formatDate(leave.end_date)}</td>
                        <td className="py-2 px-3">{leave.days}</td>
                        <td className="py-2 px-3 text-gray-500">{formatDate(leave.applied_on)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Employee view
  const latestPayslip = myPayroll[0]
  const pendingMyLeaves = myLeaves.filter((l) => l.status === 'pending').length
  const approvedMyLeaves = myLeaves.filter((l) => l.status === 'approved').length

  const attendancePieData = mySummary ? [
    { name: 'Present', value: mySummary.present },
    { name: 'Absent', value: mySummary.absent },
    { name: 'Half Day', value: mySummary.half_day },
    { name: 'Holiday', value: mySummary.holiday },
    { name: 'Weekend', value: mySummary.weekend },
  ].filter((d) => d.value > 0) : []

  return (
    <div>
      <PageHeader title="My Dashboard" subtitle={`${user?.username} — ${new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`} />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard title="Days Present" value={mySummary?.present ?? '—'} sub="this month" icon={UserCheck} color="bg-green-500" />
        <StatCard title="Pending Leaves" value={pendingMyLeaves} icon={Clock} color="bg-yellow-500" />
        <StatCard title="Approved Leaves" value={approvedMyLeaves} sub="this month" icon={FileTextIcon} color="bg-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>Attendance — {new Date().toLocaleString('en-IN', { month: 'long' })}</CardTitle></CardHeader>
          <CardContent>
            {attendancePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={attendancePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {attendancePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 py-10 text-center">No attendance data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Latest Payslip</CardTitle></CardHeader>
          <CardContent>
            {latestPayslip ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Month</span>
                  <span className="font-medium">{new Date(latestPayslip.year, latestPayslip.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Gross Salary</span>
                  <span>{formatCurrency(latestPayslip.gross_salary)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Deductions</span>
                  <span className="text-red-600">-{formatCurrency(latestPayslip.total_deductions)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-3">
                  <span>Net Salary</span>
                  <span className="text-green-600">{formatCurrency(latestPayslip.net_salary)}</span>
                </div>
                <Badge variant={latestPayslip.status === 'finalized' ? 'success' : 'warning'} className="capitalize">
                  {latestPayslip.status}
                </Badge>
              </div>
            ) : <p className="text-sm text-gray-400 py-4 text-center">No payslips yet</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Leave Requests</CardTitle></CardHeader>
        <CardContent>
          {myLeaves.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No leave requests</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Type</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">From</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">To</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Days</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.slice(0, 8).map((leave) => (
                    <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-3"><Badge variant="secondary">{leave.leave_type}</Badge></td>
                      <td className="py-2 px-3 text-gray-600">{formatDate(leave.start_date)}</td>
                      <td className="py-2 px-3 text-gray-600">{formatDate(leave.end_date)}</td>
                      <td className="py-2 px-3">{leave.days}</td>
                      <td className="py-2 px-3">
                        <LeaveStatusBadge status={leave.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
    approved: 'success',
    pending: 'warning',
    rejected: 'destructive',
    cancelled: 'secondary',
  }
  return <Badge variant={map[status] ?? 'secondary'} className="capitalize">{status}</Badge>
}
