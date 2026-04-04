import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
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
import { formatDate, formatCurrency } from '@/lib/utils'
import { Search, Plus, Upload, UserPen } from 'lucide-react'
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
  employment_type: z.string().default('full_time'),
  basic_salary: z.coerce.number().default(0),
  hra: z.coerce.number().default(0),
  special_allowance: z.coerce.number().default(0),
  conveyance_allowance: z.coerce.number().default(0),
  medical_allowance: z.coerce.number().default(0),
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
type AddFormValues = z.infer<typeof addSchema>

const editSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department_id: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
  basic_salary: z.coerce.number().optional(),
  hra: z.coerce.number().optional(),
  special_allowance: z.coerce.number().optional(),
})
type EditFormValues = z.infer<typeof editSchema>

export default function EmployeesPage() {
  const { isAdmin, isManager } = useAuth()
  const [tab, setTab] = useState<TabKey>('list')
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selectedEmpId, setSelectedEmpId] = useState<number | null>(null)
  const [addSuccess, setAddSuccess] = useState('')
  const [editSuccess, setEditSuccess] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [error, setError] = useState('')
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addForm = useForm<AddFormValues>({ resolver: zodResolver(addSchema) as any })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editForm = useForm<EditFormValues>({ resolver: zodResolver(editSchema) as any })

  const createMutation = useMutation({
    mutationFn: employeeApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      addForm.reset()
      setAddSuccess('Employee added successfully')
      setError('')
      setTimeout(() => setAddSuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to add employee')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EditFormValues }) => employeeApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      qc.invalidateQueries({ queryKey: ['employee', selectedEmpId] })
      setEditSuccess('Employee updated')
      setTimeout(() => setEditSuccess(''), 3000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Update failed')
    },
  })

  function handleSelectForEdit(id: number) {
    setSelectedEmpId(id)
    setTab('edit')
    editForm.reset()
  }

  // When employee loads, populate edit form
  if (selectedEmp && tab === 'edit') {
    const current = editForm.getValues()
    if (!current.first_name) {
      editForm.reset({
        first_name: selectedEmp.first_name,
        last_name: selectedEmp.last_name,
        phone: selectedEmp.phone,
        designation: selectedEmp.designation,
        department_id: selectedEmp.department_id,
        is_active: selectedEmp.is_active,
        basic_salary: Number(selectedEmp.basic_salary),
        hra: Number(selectedEmp.hra),
        special_allowance: Number(selectedEmp.special_allowance),
      })
    }
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'list', label: 'Employee List' },
    ...(isAdmin ? [{ key: 'add' as TabKey, label: 'Add Employee' }] : []),
    { key: 'edit', label: 'Edit Employee' },
    { key: 'upload', label: 'Upload Document' },
  ]

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage your workforce" />

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError('') }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search by name, code, email..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-44">
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
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
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Code</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Name</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Email</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Department</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Designation</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Joining</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Basic</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                        {(isAdmin || isManager) && <th className="py-3 px-4"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{emp.emp_code}</td>
                          <td className="py-2.5 px-4 font-medium">{emp.first_name} {emp.last_name}</td>
                          <td className="py-2.5 px-4 text-gray-500">{emp.email}</td>
                          <td className="py-2.5 px-4 text-gray-500">{emp.department?.name ?? '—'}</td>
                          <td className="py-2.5 px-4 text-gray-500">{emp.designation ?? '—'}</td>
                          <td className="py-2.5 px-4 text-gray-500">{formatDate(emp.date_of_joining)}</td>
                          <td className="py-2.5 px-4">{formatCurrency(emp.basic_salary ?? 0)}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant={emp.is_active ? 'success' : 'secondary'}>{emp.is_active ? 'Active' : 'Inactive'}</Badge>
                          </td>
                          {(isAdmin || isManager) && (
                            <td className="py-2.5 px-4">
                              <button onClick={() => handleSelectForEdit(emp.id)} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                                <UserPen className="w-3.5 h-3.5" /> Edit
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
            {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
            {addSuccess && <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{addSuccess}</div>}
            <form onSubmit={addForm.handleSubmit((d) => createMutation.mutate(d))}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                  </Select>
                </FormField>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Salary (₹/month)</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <FormField label="Basic"><Input {...addForm.register('basic_salary')} type="number" /></FormField>
                <FormField label="HRA"><Input {...addForm.register('hra')} type="number" /></FormField>
                <FormField label="Special Allowance"><Input {...addForm.register('special_allowance')} type="number" /></FormField>
                <FormField label="Conveyance"><Input {...addForm.register('conveyance_allowance')} type="number" /></FormField>
                <FormField label="Medical"><Input {...addForm.register('medical_allowance')} type="number" /></FormField>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statutory & Banking</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <FormField label="PAN"><Input {...addForm.register('pan')} /></FormField>
                <FormField label="Aadhaar"><Input {...addForm.register('aadhaar')} /></FormField>
                <FormField label="UAN"><Input {...addForm.register('uan')} /></FormField>
                <FormField label="Bank Account"><Input {...addForm.register('bank_account')} /></FormField>
                <FormField label="IFSC Code"><Input {...addForm.register('ifsc_code')} /></FormField>
                <FormField label="Bank Name"><Input {...addForm.register('bank_name')} /></FormField>
              </div>

              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Address</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <FormField label="Street" className="col-span-2"><Input {...addForm.register('address')} /></FormField>
                <FormField label="City"><Input {...addForm.register('city')} /></FormField>
                <FormField label="State"><Input {...addForm.register('state')} /></FormField>
                <FormField label="Pincode"><Input {...addForm.register('pincode')} /></FormField>
              </div>

              <Button type="submit" loading={createMutation.isPending}>
                <Plus className="w-4 h-4" /> Add Employee
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
                  setSelectedEmpId(Number(e.target.value))
                  editForm.reset()
                }}
              >
                <option value="">-- Select --</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.emp_code})</option>)}
              </Select>
            </div>

            {editSuccess && <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{editSuccess}</div>}
            {error && <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}

            {selectedEmpId && (
              <form onSubmit={editForm.handleSubmit((d) => updateMutation.mutate({ id: selectedEmpId, data: d }))}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
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
                  <FormField label="Basic Salary"><Input {...editForm.register('basic_salary')} type="number" /></FormField>
                  <FormField label="HRA"><Input {...editForm.register('hra')} type="number" /></FormField>
                  <FormField label="Special Allowance"><Input {...editForm.register('special_allowance')} type="number" /></FormField>
                </div>
                <Button type="submit" loading={updateMutation.isPending}>Save Changes</Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'upload' && (
        <UploadDocumentTab employees={employees} successMsg={uploadSuccess} setSuccessMsg={setUploadSuccess} />
      )}
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
      <CardContent className="p-5 max-w-md space-y-4">
        {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
        {successMsg && <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{successMsg}</div>}
        <div className="space-y-1.5">
          <Label>Employee</Label>
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
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
          <Upload className="w-4 h-4" /> Upload
        </Button>
      </CardContent>
    </Card>
  )
}
