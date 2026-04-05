import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Upload, UserPen } from 'lucide-react'
import type { Employee } from '@/types'

type TabKey = 'list' | 'add' | 'edit' | 'upload'

const addSchema = z.object({
  emp_code: z.string().min(1),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional(),
  date_of_joining: z.string().min(1),
  department_id: z.coerce.number().optional(),
  designation: z.string().optional(),
  employment_type: z.string().default('permanent'),
  annual_ctc: z.coerce.number().optional(),
  pan: z.string().optional(),
  aadhaar: z.string().optional(),
  uan: z.string().optional(),
  bank_account: z.string().optional(),
  ifsc_code: z.string().optional(),
  bank_name: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
})

const editSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department_id: z.coerce.number().optional(),
  position_id: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
  annual_ctc: z.coerce.number().optional(),
})

type AddFormValues = z.infer<typeof addSchema>
type EditFormValues = z.infer<typeof editSchema>

function lifecycleBadge(stage?: Employee['lifecycle_stage']) {
  switch (stage) {
    case 'hiring': return 'secondary'
    case 'onboarding': return 'warning'
    case 'active': return 'success'
    case 'exit_initiated': return 'warning'
    case 'exited': return 'secondary'
    default: return 'secondary'
  }
}

function lifecycleLabel(stage?: Employee['lifecycle_stage']) {
  switch (stage) {
    case 'hiring': return 'Hiring'
    case 'onboarding': return 'Onboarding'
    case 'active': return 'Active'
    case 'exit_initiated': return 'Exit Initiated'
    case 'exited': return 'Exited'
    default: return 'Hiring'
  }
}

function offerLabel(status?: Employee['offer_status']) {
  switch (status) {
    case 'released': return 'Offer Released'
    case 'accepted': return 'Offer Accepted'
    case 'declined': return 'Offer Declined'
    default: return 'Offer Draft'
  }
}

function lifecycleSummary(emp: Employee) {
  if (emp.lifecycle_stage === 'exited' && emp.exit_date) return `Exited on ${formatDate(emp.exit_date)}`
  if (emp.lifecycle_stage === 'exit_initiated' && emp.exit_initiated_on) return `Exit initiated on ${formatDate(emp.exit_initiated_on)}`
  if (emp.lifecycle_stage === 'active' && emp.onboarding_completed_on) return `Active since ${formatDate(emp.onboarding_completed_on)}`
  if (emp.lifecycle_stage === 'onboarding' && emp.onboarding_started_on) return `Onboarding started on ${formatDate(emp.onboarding_started_on)}`
  if (emp.offer_status === 'accepted' && emp.offer_accepted_on) return `Offer accepted on ${formatDate(emp.offer_accepted_on)}`
  if (emp.offer_status === 'released' && emp.offer_released_on) return `Offer released on ${formatDate(emp.offer_released_on)}`
  return 'No lifecycle event recorded yet.'
}

export default function EmployeesPage() {
  const { isAdmin, isManager } = useAuth()
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState<TabKey>('list')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null)
  const [lifecycleDate, setLifecycleDate] = useState('')
  const [exitReason, setExitReason] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [editSuccess, setEditSuccess] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [error, setError] = useState('')
  const populatedForId = useRef<number | null>(null)
  const qc = useQueryClient()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', { is_active: showInactive ? undefined : true, search: search || undefined, department_id: deptFilter ? Number(deptFilter) : undefined }],
    queryFn: () => employeeApi.list({ is_active: showInactive ? undefined : true, search: search || undefined, department_id: deptFilter ? Number(deptFilter) : undefined }),
  })
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: employeeApi.departments })
  const { data: selectedEmp } = useQuery({
    queryKey: ['employee', selectedEmpId],
    queryFn: () => employeeApi.get(selectedEmpId!),
    enabled: !!selectedEmpId,
  })

  const addForm = useForm<AddFormValues>({ resolver: zodResolver(addSchema) as never })
  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editSchema) as never })

  const createMutation = useMutation({
    mutationFn: employeeApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      addForm.reset()
      setAddSuccess('Employee record created')
      setError('')
      setTimeout(() => setAddSuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => setError(err.response?.data?.detail || 'Failed to add employee'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditFormValues }) => employeeApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee', selectedEmpId] })
      setEditSuccess('Employee updated')
      setTimeout(() => setEditSuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => setError(err.response?.data?.detail || 'Update failed'),
  })

  const lifecycleMutation = useMutation({
    mutationFn: ({ id, lifecycle_stage, effective_date, exit_reason }: { id: number; lifecycle_stage: string; effective_date?: string; exit_reason?: string }) =>
      employeeApi.updateLifecycle(id, { lifecycle_stage, effective_date, exit_reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee', selectedEmpId] })
      setEditSuccess('Lifecycle updated')
      setTimeout(() => setEditSuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => setError(err.response?.data?.detail || 'Lifecycle update failed'),
  })

  function resetEditWorkspace() {
    populatedForId.current = null
    editForm.reset()
    setLifecycleDate('')
    setExitReason('')
  }

  function handleSelectForEdit(id: number) {
    resetEditWorkspace()
    setSelectedEmpId(id)
    setTab('edit')
  }

  if (selectedEmp && tab === 'edit' && populatedForId.current !== selectedEmp.id) {
    populatedForId.current = selectedEmp.id
    editForm.reset({
      first_name: selectedEmp.first_name,
      last_name: selectedEmp.last_name,
      phone: selectedEmp.phone,
      designation: selectedEmp.designation,
      department_id: selectedEmp.department_id,
      position_id: selectedEmp.position_id,
      is_active: selectedEmp.is_active,
      annual_ctc: selectedEmp.annual_ctc ? Number(selectedEmp.annual_ctc) : undefined,
    })
  }

  useEffect(() => {
    const nextTab = searchParams.get('tab')
    const nextEmployeeId = searchParams.get('employeeId')
    if (nextTab && ['list', 'add', 'edit', 'upload'].includes(nextTab)) {
      setTab(nextTab as TabKey)
    }
    if (nextEmployeeId) {
      const parsedId = Number(nextEmployeeId)
      if (parsedId) {
        resetEditWorkspace()
        setSelectedEmpId(parsedId)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'list', label: 'Employee List' },
    ...(isAdmin ? [{ key: 'add' as TabKey, label: 'Direct Entry' }] : []),
    { key: 'edit', label: 'Edit Employee' },
    { key: 'upload', label: 'Upload Document' },
  ]

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage your workforce" />

      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError('') }}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div>
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search by name, code, email..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-44">
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
              Show Inactive
            </label>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
              ) : employees.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No employees found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Position</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Designation</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Joining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Lifecycle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Offer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Annual CTC</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                        {(isAdmin || isManager) && <th className="px-4 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{emp.emp_code}</td>
                          <td className="px-4 py-2.5 font-medium">{emp.first_name} {emp.last_name}</td>
                          <td className="px-4 py-2.5 text-gray-500">{emp.email}</td>
                          <td className="px-4 py-2.5 text-gray-500">{emp.department?.name ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{emp.position?.title ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{emp.designation ?? '-'}</td>
                          <td className="px-4 py-2.5 text-gray-500">{formatDate(emp.date_of_joining)}</td>
                          <td className="px-4 py-2.5"><Badge variant={lifecycleBadge(emp.lifecycle_stage)}>{lifecycleLabel(emp.lifecycle_stage)}</Badge></td>
                          <td className="px-4 py-2.5 text-xs text-gray-600">{offerLabel(emp.offer_status)}</td>
                          <td className="px-4 py-2.5">{emp.annual_ctc ? formatCurrency(Number(emp.annual_ctc)) : '-'}</td>
                          <td className="px-4 py-2.5"><Badge variant={emp.is_active ? 'success' : 'secondary'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge></td>
                          {(isAdmin || isManager) && (
                            <td className="px-4 py-2.5">
                              <button onClick={() => handleSelectForEdit(emp.id)} className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <UserPen className="h-3.5 w-3.5" /> Edit
                              </button>
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

      {tab === 'add' && isAdmin && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Use this only for exceptional manual cases such as legacy imports, direct walk-ins, or contractor records. Standard hiring should move through the Positions workspace.
            </div>
            {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            {addSuccess && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">{addSuccess}</div>}

            <form onSubmit={addForm.handleSubmit((d) => createMutation.mutate(d))}>
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <FormField label="Employee Code *" error={addForm.formState.errors.emp_code?.message}><Input {...addForm.register('emp_code')} placeholder="E001" /></FormField>
                <FormField label="First Name *" error={addForm.formState.errors.first_name?.message}><Input {...addForm.register('first_name')} /></FormField>
                <FormField label="Last Name *" error={addForm.formState.errors.last_name?.message}><Input {...addForm.register('last_name')} /></FormField>
                <FormField label="Email *" error={addForm.formState.errors.email?.message}><Input {...addForm.register('email')} type="email" /></FormField>
                <FormField label="Phone"><Input {...addForm.register('phone')} /></FormField>
                <FormField label="Gender">
                  <Select {...addForm.register('gender')}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </FormField>
                <FormField label="Date of Birth"><Input {...addForm.register('date_of_birth')} type="date" /></FormField>
                <FormField label="Date of Joining *" error={addForm.formState.errors.date_of_joining?.message}><Input {...addForm.register('date_of_joining')} type="date" /></FormField>
                <FormField label="Department">
                  <Select {...addForm.register('department_id')}>
                    <option value="">Select</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="Designation"><Input {...addForm.register('designation')} /></FormField>
                <FormField label="Employment Type">
                  <Select {...addForm.register('employment_type')}>
                    <option value="permanent">Permanent</option>
                    <option value="contractor">Contractor</option>
                    <option value="trainee">Trainee</option>
                    <option value="intern">Intern</option>
                  </Select>
                </FormField>
              </div>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Compensation</p>
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                <FormField label="Annual CTC (Rs)"><Input {...addForm.register('annual_ctc')} type="number" placeholder="e.g. 600000" /></FormField>
              </div>
              <p className="mb-6 text-xs text-gray-400">Salary structures will split Annual CTC into Gross Salary, Employer Contributions, and Employee Deductions.</p>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Statutory and Banking</p>
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
                <FormField label="PAN"><Input {...addForm.register('pan')} /></FormField>
                <FormField label="Aadhaar"><Input {...addForm.register('aadhaar')} /></FormField>
                <FormField label="UAN"><Input {...addForm.register('uan')} /></FormField>
                <FormField label="Bank Account"><Input {...addForm.register('bank_account')} /></FormField>
                <FormField label="IFSC Code"><Input {...addForm.register('ifsc_code')} /></FormField>
                <FormField label="Bank Name"><Input {...addForm.register('bank_name')} /></FormField>
              </div>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Address</p>
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <FormField label="Street" className="col-span-2"><Input {...addForm.register('address')} /></FormField>
                <FormField label="City"><Input {...addForm.register('city')} /></FormField>
                <FormField label="State"><Input {...addForm.register('state')} /></FormField>
                <FormField label="Pincode"><Input {...addForm.register('pincode')} /></FormField>
              </div>

              <Button type="submit" loading={createMutation.isPending}>
                <Plus className="h-4 w-4" /> Create Employee Record
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'edit' && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-4">
              <Label>Select Employee</Label>
              <Select
                className="mt-1.5 w-72"
                value={selectedEmpId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null
                  resetEditWorkspace()
                  setSelectedEmpId(nextId)
                }}
              >
                <option value="">-- Select --</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.emp_code})</option>)}
              </Select>
            </div>

            {editSuccess && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">{editSuccess}</div>}
            {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

            {!selectedEmpId && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                Select an employee to manage profile details, employee lifecycle, and separation.
              </div>
            )}

            {selectedEmpId && (
              <div className="space-y-5">
                <Card className="border-gray-200">
                  <CardContent className="p-5">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Employee Details</p>
                        <p className="mt-1 text-xs text-gray-500">Update core profile, department, and compensation details here.</p>
                      </div>
                      {selectedEmp && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={lifecycleBadge(selectedEmp.lifecycle_stage)}>{lifecycleLabel(selectedEmp.lifecycle_stage)}</Badge>
                          <Badge variant="secondary">{offerLabel(selectedEmp.offer_status)}</Badge>
                        </div>
                      )}
                    </div>

                    <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate({ id: selectedEmpId, data }))}>
                      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <FormField label="First Name *"><Input {...editForm.register('first_name')} /></FormField>
                        <FormField label="Last Name *"><Input {...editForm.register('last_name')} /></FormField>
                        <FormField label="Phone"><Input {...editForm.register('phone')} /></FormField>
                        <FormField label="Designation"><Input {...editForm.register('designation')} /></FormField>
                        <FormField label="Department">
                          <Select {...editForm.register('department_id')}>
                            <option value="">Select</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </Select>
                        </FormField>
                        <FormField label="Active">
                          <Select {...editForm.register('is_active', { setValueAs: (v) => v === 'true' })}>
                            <option value="true">Active</option>
                            <option value="false">Inactive</option>
                          </Select>
                        </FormField>
                        <FormField label="Annual CTC (Rs)"><Input {...editForm.register('annual_ctc')} type="number" placeholder="e.g. 600000" /></FormField>
                      </div>

                      {selectedEmp && (
                        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Hiring Source</p>
                          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <InfoTile label="Position" value={selectedEmp.position?.title || '-'} />
                            <InfoTile label="Candidate" value={selectedEmp.candidate ? `${selectedEmp.candidate.first_name} ${selectedEmp.candidate.last_name}` : '-'} />
                            <InfoTile label="Offer Status" value={selectedEmp.offer?.status || selectedEmp.offer_status || '-'} />
                            <InfoTile label="Offer Accepted" value={selectedEmp.offer_accepted_on ? formatDate(selectedEmp.offer_accepted_on) : '-'} />
                          </div>
                        </div>
                      )}

                      {selectedEmp?.position && (
                        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                          Position is managed from the Positions workspace. Current role: <span className="font-semibold">{selectedEmp.position.title}</span>
                          {selectedEmp.position.department?.name ? ` in ${selectedEmp.position.department.name}` : ''}.
                        </div>
                      )}

                      <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
                    </form>
                  </CardContent>
                </Card>

                {selectedEmp && (
                  <Card className="border-gray-200">
                    <CardContent className="p-5">
                      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">Employment Lifecycle</p>
                          <p className="mt-1 text-xs text-gray-500">Manage the employee after joining, including activation, exit initiation, and completion.</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Badge variant={lifecycleBadge(selectedEmp.lifecycle_stage)}>{lifecycleLabel(selectedEmp.lifecycle_stage)}</Badge>
                            <Badge variant="secondary">{offerLabel(selectedEmp.offer_status)}</Badge>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">{lifecycleSummary(selectedEmp)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="rounded-xl border border-gray-200 bg-white">
                          <div className="border-b border-gray-100 px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lifecycle Actions</p>
                          </div>
                          <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormField label="Effective Date">
                                <Input type="date" value={lifecycleDate} onChange={(e) => setLifecycleDate(e.target.value)} />
                              </FormField>
                              <FormField label="Exit Reason">
                                <Input value={exitReason} onChange={(e) => setExitReason(e.target.value)} placeholder="Use only when processing separation" />
                              </FormField>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => lifecycleMutation.mutate({ id: selectedEmp.id, lifecycle_stage: 'active', effective_date: lifecycleDate || undefined })} loading={lifecycleMutation.isPending}>Mark Active</Button>
                              <Button size="sm" variant="outline" onClick={() => lifecycleMutation.mutate({ id: selectedEmp.id, lifecycle_stage: 'exit_initiated', effective_date: lifecycleDate || undefined, exit_reason: exitReason || undefined })} loading={lifecycleMutation.isPending}>Initiate Exit</Button>
                              <Button size="sm" variant="outline" onClick={() => lifecycleMutation.mutate({ id: selectedEmp.id, lifecycle_stage: 'exited', effective_date: lifecycleDate || undefined, exit_reason: exitReason || undefined })} loading={lifecycleMutation.isPending}>Complete Exit</Button>
                            </div>
                            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-sm text-gray-600">
                              Pre-join steps such as candidate creation, offer release, and onboarding are managed from the Positions workspace.
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lifecycle Timeline</p>
                          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                            <LifecycleEvent label="Offer Released" value={selectedEmp.offer_released_on} />
                            <LifecycleEvent label="Offer Accepted" value={selectedEmp.offer_accepted_on} />
                            <LifecycleEvent label="Onboarding Started" value={selectedEmp.onboarding_started_on} />
                            <LifecycleEvent label="Onboarding Completed" value={selectedEmp.onboarding_completed_on} />
                            <LifecycleEvent label="Exit Initiated" value={selectedEmp.exit_initiated_on} />
                            <LifecycleEvent label="Exit Date" value={selectedEmp.exit_date} />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'upload' && <UploadDocumentTab employees={employees} successMsg={uploadSuccess} setSuccessMsg={setUploadSuccess} />}
    </div>
  )
}

function FormField({ label, children, error, className }: { label: string; children: React.ReactNode; error?: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-800">{value}</p>
    </div>
  )
}

function LifecycleEvent({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-700">{value ? formatDate(value) : 'Not completed'}</p>
    </div>
  )
}

function UploadDocumentTab({ employees, successMsg, setSuccessMsg }: { employees: Employee[]; successMsg: string; setSuccessMsg: (s: string) => void }) {
  const [empId, setEmpId] = useState('')
  const [docType, setDocType] = useState('other')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUpload() {
    if (!empId || !file) return
    setLoading(true)
    setError('')
    try {
      await employeeApi.uploadDocument(Number(empId), file, docType)
      setSuccessMsg('Document uploaded successfully')
      setFile(null)
    } catch {
      setError('Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="max-w-md space-y-4 p-5">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        {successMsg && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-600">{successMsg}</div>}
        <div className="space-y-1.5">
          <Label>Employee</Label>
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Document Type</Label>
          <Select value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="offer_letter">Offer Letter</option>
            <option value="pan_card">PAN Card</option>
            <option value="aadhaar">Aadhaar</option>
            <option value="payslip">Payslip</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>File</Label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </div>
        <Button onClick={handleUpload} disabled={!empId || !file} loading={loading}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </CardContent>
    </Card>
  )
}
