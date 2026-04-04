import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { leaveApi, employeeApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { LeaveStatusBadge } from '@/pages/dashboard/DashboardPage'
import { formatDate } from '@/lib/utils'
import { Check, X } from 'lucide-react'

type TabKey = 'all' | 'pending' | 'apply' | 'balances'

const applySchema = z.object({
  leave_type: z.enum(['CL', 'SL', 'EL', 'LOP']),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().optional(),
})
type ApplyFormValues = z.infer<typeof applySchema>

const now = new Date()

export default function LeavesPage() {
  const { isAdmin, isManager } = useAuth()
  const isAdminOrManager = isAdmin || isManager
  const [tab, setTab] = useState<TabKey>(isAdminOrManager ? 'all' : 'apply')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEmpId, setFilterEmpId] = useState('')
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [rejectionReason, setRejectionReason] = useState<Record<number, string>>({})
  const qc = useQueryClient()

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', { is_active: true }],
    queryFn: () => employeeApi.list({ is_active: true }),
    enabled: isAdminOrManager,
  })

  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leaves', { status: filterStatus || undefined, employee_id: filterEmpId ? Number(filterEmpId) : undefined, year: filterYear }],
    queryFn: () => leaveApi.list({ status: filterStatus || undefined, employee_id: filterEmpId ? Number(filterEmpId) : undefined, year: filterYear }),
  })

  const pendingLeaves = leaves.filter((l) => l.status === 'pending')

  const approveMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: 'approved' | 'rejected'; reason?: string }) =>
      leaveApi.approve(id, status, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => leaveApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  })

  const applyForm = useForm<ApplyFormValues>({ resolver: zodResolver(applySchema) })
  const [applySuccess, setApplySuccess] = useState('')
  const [applyError, setApplyError] = useState('')

  const applyMutation = useMutation({
    mutationFn: (data: ApplyFormValues) => leaveApi.apply(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      applyForm.reset()
      setApplySuccess('Leave applied successfully')
      setTimeout(() => setApplySuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setApplyError(err.response?.data?.detail || 'Failed to apply leave')
    },
  })

  const adminApplyForm = useForm<ApplyFormValues & { employee_id: number }>()
  const [adminApplySuccess, setAdminApplySuccess] = useState('')

  const adminApplyMutation = useMutation({
    mutationFn: ({ employee_id, ...data }: ApplyFormValues & { employee_id: number }) =>
      leaveApi.adminApply(employee_id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leaves'] })
      adminApplyForm.reset()
      setAdminApplySuccess('Leave applied on behalf of employee')
      setTimeout(() => setAdminApplySuccess(''), 3000)
    },
  })

  const tabs = isAdminOrManager
    ? [
        { key: 'all' as TabKey, label: 'All Leaves' },
        { key: 'pending' as TabKey, label: `Pending (${pendingLeaves.length})` },
        { key: 'apply' as TabKey, label: 'Apply (Admin)' },
        { key: 'balances' as TabKey, label: 'Balances' },
      ]
    : [
        { key: 'all' as TabKey, label: 'My Leaves' },
        { key: 'apply' as TabKey, label: 'Apply Leave' },
      ]

  return (
    <div>
      <PageHeader title="Leave Management" />
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'all' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            {isAdminOrManager && (
              <Select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} className="w-52">
                <option value="">All Employees</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </Select>
            )}
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-36">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-24">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
              ) : leaves.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No leave requests</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">#</th>
                        {isAdminOrManager && <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Employee</th>}
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Type</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">From</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">To</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Days</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Applied</th>
                        {!isAdminOrManager && <th className="py-3 px-4"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4 text-gray-400 text-xs">{leave.id}</td>
                          {isAdminOrManager && (
                            <td className="py-2.5 px-4">{leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : `#${leave.employee_id}`}</td>
                          )}
                          <td className="py-2.5 px-4"><Badge variant="secondary">{leave.leave_type}</Badge></td>
                          <td className="py-2.5 px-4 text-gray-600">{formatDate(leave.start_date)}</td>
                          <td className="py-2.5 px-4 text-gray-600">{formatDate(leave.end_date)}</td>
                          <td className="py-2.5 px-4">{leave.days}</td>
                          <td className="py-2.5 px-4"><LeaveStatusBadge status={leave.status} /></td>
                          <td className="py-2.5 px-4 text-gray-500">{formatDate(leave.applied_on)}</td>
                          {!isAdminOrManager && leave.status === 'pending' && (
                            <td className="py-2.5 px-4">
                              <button onClick={() => cancelMutation.mutate(leave.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'pending' && isAdminOrManager && (
        <div className="space-y-3">
          {pendingLeaves.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-gray-400">No pending leaves</CardContent></Card>
          ) : pendingLeaves.map((leave) => (
            <Card key={leave.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{leave.employee ? `${leave.employee.first_name} ${leave.employee.last_name}` : `Employee #${leave.employee_id}`}</span>
                      <Badge variant="secondary">{leave.leave_type}</Badge>
                      <span className="text-xs text-gray-400">#{leave.id}</span>
                    </div>
                    <p className="text-sm text-gray-600">{formatDate(leave.start_date)} → {formatDate(leave.end_date)} ({leave.days} days)</p>
                    {leave.reason && <p className="text-sm text-gray-500 italic">"{leave.reason}"</p>}
                    <p className="text-xs text-gray-400">Applied: {formatDate(leave.applied_on)}</p>
                  </div>
                  <div className="flex flex-col gap-2 min-w-48">
                    <Input
                      placeholder="Rejection reason (optional)"
                      value={rejectionReason[leave.id] ?? ''}
                      onChange={(e) => setRejectionReason((p) => ({ ...p, [leave.id]: e.target.value }))}
                      className="text-xs h-8"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => approveMutation.mutate({ id: leave.id, status: 'approved' })}
                        loading={approveMutation.isPending}
                        className="flex-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => approveMutation.mutate({ id: leave.id, status: 'rejected', reason: rejectionReason[leave.id] })}
                        loading={approveMutation.isPending}
                        className="flex-1"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === 'apply' && !isAdminOrManager && (
        <Card>
          <CardContent className="p-5 max-w-md">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700 space-y-1">
              <p><strong>CL</strong> – Casual Leave (12/year)</p>
              <p><strong>SL</strong> – Sick Leave (12/year)</p>
              <p><strong>EL</strong> – Earned Leave (15/year)</p>
              <p><strong>LOP</strong> – Loss of Pay</p>
            </div>
            {applyError && <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{applyError}</div>}
            {applySuccess && <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{applySuccess}</div>}
            <form onSubmit={applyForm.handleSubmit((d) => applyMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Leave Type</Label>
                <Select {...applyForm.register('leave_type')}>
                  <option value="CL">CL – Casual Leave</option>
                  <option value="SL">SL – Sick Leave</option>
                  <option value="EL">EL – Earned Leave</option>
                  <option value="LOP">LOP – Loss of Pay</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" {...applyForm.register('start_date')} />
                  {applyForm.formState.errors.start_date && <p className="text-xs text-red-500">Required</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" {...applyForm.register('end_date')} />
                  {applyForm.formState.errors.end_date && <p className="text-xs text-red-500">Required</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Reason</Label>
                <Textarea {...applyForm.register('reason')} placeholder="Optional reason..." rows={3} />
              </div>
              <Button type="submit" loading={applyMutation.isPending}>Apply Leave</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'apply' && isAdminOrManager && (
        <Card>
          <CardHeader><CardTitle>Apply Leave on Behalf</CardTitle></CardHeader>
          <CardContent className="p-5 max-w-md">
            {adminApplySuccess && <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{adminApplySuccess}</div>}
            <form onSubmit={adminApplyForm.handleSubmit((d) => adminApplyMutation.mutate(d))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select {...adminApplyForm.register('employee_id', { valueAsNumber: true })}>
                  <option value="">Select employee</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Leave Type</Label>
                <Select {...adminApplyForm.register('leave_type')}>
                  <option value="CL">CL</option><option value="SL">SL</option><option value="EL">EL</option><option value="LOP">LOP</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Start Date</Label><Input type="date" {...adminApplyForm.register('start_date')} /></div>
                <div className="space-y-1.5"><Label>End Date</Label><Input type="date" {...adminApplyForm.register('end_date')} /></div>
              </div>
              <div className="space-y-1.5"><Label>Reason</Label><Textarea {...adminApplyForm.register('reason')} rows={2} /></div>
              <Button type="submit" loading={adminApplyMutation.isPending}>Apply</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'balances' && isAdminOrManager && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Code</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Department</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 text-center">CL</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 text-center">SL</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 text-center">EL</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{e.emp_code}</td>
                      <td className="py-2.5 px-4 font-medium">{e.first_name} {e.last_name}</td>
                      <td className="py-2.5 px-4 text-gray-500">{e.department?.name ?? '—'}</td>
                      <td className="py-2.5 px-4 text-center">{e.cl_balance}</td>
                      <td className="py-2.5 px-4 text-center">{e.sl_balance}</td>
                      <td className="py-2.5 px-4 text-center">{e.el_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
