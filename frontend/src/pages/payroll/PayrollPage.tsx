import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { payrollApi, employeeApi, profileApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Download, CheckCircle, Eye, Wallet, X } from 'lucide-react'
import type { Employee, PayrollRecord } from '@/types'

type TabKey = 'register' | 'generate' | 'bulk' | 'payslips'

function PayslipPreviewModal({ record, onClose, onDownload }: { record: PayrollRecord; onClose: () => void; onDownload: () => void }) {
  const empName = record.employee ? `${record.employee.first_name} ${record.employee.last_name}` : `Employee #${record.employee_id}`
  const empCode = record.employee?.emp_code ?? ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Payslip Preview</h2>
            <p className="text-xs text-gray-500">{MONTHS[record.month - 1]} {record.year}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onDownload}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download PDF
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Payslip body */}
        <div className="p-6">
          {/* Company & period */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-blue-700 text-lg">HR Portal</h3>
              <p className="text-xs text-gray-500 mt-0.5">Salary Slip</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-800">{MONTHS[record.month - 1]} {record.year}</p>
              <Badge variant={record.status === 'finalized' ? 'success' : 'warning'} className="capitalize mt-1">{record.status}</Badge>
            </div>
          </div>

          {/* Employee info */}
          <div className="grid grid-cols-2 gap-4 mb-6 pb-4 border-b border-gray-100">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Employee Name</p>
              <p className="text-sm font-semibold text-gray-800">{empName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Employee Code</p>
              <p className="text-sm font-semibold text-gray-800 font-mono">{empCode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Department</p>
              <p className="text-sm font-semibold text-gray-800">{record.employee?.department?.name ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Designation</p>
              <p className="text-sm font-semibold text-gray-800">{record.employee?.designation ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Working Days</p>
              <p className="text-sm font-semibold text-gray-800">{record.working_days}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Present Days / LOP</p>
              <p className="text-sm font-semibold text-gray-800">{record.present_days} / {record.lop_days}</p>
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Earnings</h4>
              <div className="space-y-2">
                {[
                  { label: 'Basic', value: record.basic },
                  { label: 'HRA', value: record.hra },
                  { label: 'Special Allowance', value: record.special_allowance },
                  { label: 'Conveyance', value: record.conveyance_allowance },
                  { label: 'Medical', value: record.medical_allowance },
                  { label: 'Other Earnings', value: record.other_earnings },
                ].filter((e) => Number(e.value) > 0).map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-gray-800">{formatCurrency(Number(value))}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Gross Salary</span>
                  <span className="text-gray-900">{formatCurrency(Number(record.gross_salary))}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Deductions</h4>
              <div className="space-y-2">
                {[
                  { label: 'PF (Employee)', value: record.pf_employee },
                  { label: 'ESIC (Employee)', value: record.esic_employee },
                  { label: 'Professional Tax', value: record.professional_tax },
                  { label: 'TDS', value: record.tds },
                  { label: 'Other Deductions', value: record.other_deductions },
                ].filter((d) => Number(d.value) > 0).map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-medium text-red-600">− {formatCurrency(Number(value))}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                  <span className="text-gray-700">Total Deductions</span>
                  <span className="text-red-600">− {formatCurrency(Number(record.total_deductions))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Net salary */}
          <div className="bg-blue-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Net Take-Home Salary</p>
              <p className="text-xs text-blue-400 mt-0.5">{MONTHS[record.month - 1]} {record.year}</p>
            </div>
            <p className="text-2xl font-bold text-blue-700">{formatCurrency(Number(record.net_salary))}</p>
          </div>

          {/* Employer contributions note */}
          {(Number(record.pf_employer) > 0 || Number(record.esic_employer) > 0) && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 font-medium mb-2">Employer Contributions (not deducted from salary)</p>
              <div className="flex gap-6 text-xs">
                {Number(record.pf_employer) > 0 && (
                  <div>
                    <span className="text-gray-400">PF (Employer):</span>
                    <span className="ml-1 font-medium text-gray-700">{formatCurrency(Number(record.pf_employer))}</span>
                  </div>
                )}
                {Number(record.esic_employer) > 0 && (
                  <div>
                    <span className="text-gray-400">ESIC (Employer):</span>
                    <span className="ml-1 font-medium text-gray-700">{formatCurrency(Number(record.esic_employer))}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const now = new Date()
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

export default function PayrollPage() {
  const { user, isAdmin } = useAuth()
  const isEmployee = user?.role === 'employee'
  const [tab, setTab] = useState<TabKey>(isEmployee ? 'payslips' : 'register')
  const [filterMonth, setFilterMonth] = useState(prevMonth.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(prevMonth.getFullYear())
  const [filterDept, setFilterDept] = useState('')
  const qc = useQueryClient()

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', { is_active: true }],
    queryFn: () => employeeApi.list({ is_active: true }),
    enabled: !isEmployee,
  })

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: employeeApi.departments, enabled: !isEmployee })

  const { data: payrollList = [], isLoading } = useQuery({
    queryKey: ['payroll', { month: filterMonth, year: filterYear }],
    queryFn: () => payrollApi.list({ month: filterMonth, year: filterYear }),
  })
  const { data: myProfile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: profileApi.get,
    enabled: isEmployee,
  })

  const finalizeMutation = useMutation({
    mutationFn: (id: number) => payrollApi.finalize(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll'] }),
  })

  async function downloadPayslip(id: number, empCode: string) {
    const blob = await payrollApi.downloadPayslip(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip_${empCode}_${filterYear}_${String(filterMonth).padStart(2, '0')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs = isEmployee
    ? [{ key: 'payslips' as TabKey, label: 'My Payslips' }]
    : isAdmin
    ? [
        { key: 'register' as TabKey, label: 'Payroll Register' },
        { key: 'generate' as TabKey, label: 'Generate' },
        { key: 'bulk' as TabKey, label: 'Bulk Generate' },
        { key: 'payslips' as TabKey, label: 'Payslips' },
      ]
    : [
        { key: 'register' as TabKey, label: 'Payroll Register' },
        { key: 'payslips' as TabKey, label: 'Payslips' },
      ]

  const totalGross = payrollList.reduce((s, p) => s + Number(p.gross_salary), 0)
  const totalNet = payrollList.reduce((s, p) => s + Number(p.net_salary), 0)

  return (
    <div>
      <PageHeader title="Payroll" />
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

      {(tab === 'register') && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="w-36">
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </Select>
            <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-24">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="w-44">
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>

          {!isLoading && payrollList.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Employees</p><p className="text-xl font-bold mt-1">{payrollList.length}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Gross Salary</p><p className="text-xl font-bold mt-1">{formatCurrency(totalGross)}</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Total Net Payout</p><p className="text-xl font-bold mt-1 text-green-600">{formatCurrency(totalNet)}</p></CardContent></Card>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
              ) : payrollList.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No payroll data for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Code</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Name</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Gross Salary</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Employee PF</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Employee ESIC</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">PT</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">TDS</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Net</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Days</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                        {isAdmin && <th className="py-3 px-4"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {payrollList.map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{p.employee?.emp_code ?? '—'}</td>
                          <td className="py-2.5 px-4 font-medium">{p.employee ? `${p.employee.first_name} ${p.employee.last_name}` : `#${p.employee_id}`}</td>
                          <td className="py-2.5 px-4 text-right">{formatCurrency(p.gross_salary)}</td>
                          <td className="py-2.5 px-4 text-right text-red-600">{formatCurrency(p.pf_employee)}</td>
                          <td className="py-2.5 px-4 text-right text-red-600">{formatCurrency(p.esic_employee)}</td>
                          <td className="py-2.5 px-4 text-right text-red-600">{formatCurrency(p.professional_tax)}</td>
                          <td className="py-2.5 px-4 text-right text-red-600">{formatCurrency(p.tds)}</td>
                          <td className="py-2.5 px-4 text-right font-semibold text-green-600">{formatCurrency(p.net_salary)}</td>
                          <td className="py-2.5 px-4 text-gray-500">{p.present_days}/{p.working_days}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant={p.status === 'finalized' ? 'success' : 'warning'} className="capitalize">{p.status}</Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-4">
                              {p.status === 'draft' && (
                                <button onClick={() => finalizeMutation.mutate(p.id)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> Finalize
                                </button>
                              )}
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

      {tab === 'generate' && isAdmin && <GenerateSingleTab employees={employees} />}
      {tab === 'bulk' && isAdmin && <BulkGenerateTab departments={departments} />}

      {tab === 'payslips' && (
        <PayslipsTab
          payrollList={payrollList}
          onDownload={downloadPayslip}
          filterMonth={filterMonth}
          filterYear={filterYear}
          setFilterMonth={setFilterMonth}
          setFilterYear={setFilterYear}
          myProfile={isEmployee ? myProfile : undefined}
        />
      )}
    </div>
  )
}

function GenerateSingleTab({ employees }: { employees: { id: number; first_name: string; last_name: string }[] }) {
  const [empId, setEmpId] = useState('')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [presentDays, setPresentDays] = useState('')
  const [lopDays, setLopDays] = useState('0')
  const [otherEarnings, setOtherEarnings] = useState('0')
  const [otherDeductions, setOtherDeductions] = useState('0')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => payrollApi.generate({
      employee_id: Number(empId),
      month, year,
      present_days: presentDays ? Number(presentDays) : undefined,
      lop_days: Number(lopDays),
      other_earnings: Number(otherEarnings),
      other_deductions: Number(otherDeductions),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['payroll'] })
      setSuccess(`Payroll generated. Net: ${formatCurrency(data.net_salary)}`)
      setTimeout(() => setSuccess(''), 5000)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => setError(err.response?.data?.detail || 'Generation failed'),
  })

  return (
    <Card>
      <CardContent className="p-5 max-w-md space-y-4">
        {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
        {success && <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{success}</div>}
        <div className="space-y-1.5">
          <Label>Employee</Label>
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Select</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Present Days (auto if blank)</Label><Input type="number" value={presentDays} onChange={(e) => setPresentDays(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>LOP Days</Label><Input type="number" value={lopDays} onChange={(e) => setLopDays(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Other Earnings</Label><Input type="number" value={otherEarnings} onChange={(e) => setOtherEarnings(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Other Deductions</Label><Input type="number" value={otherDeductions} onChange={(e) => setOtherDeductions(e.target.value)} /></div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!empId} loading={mutation.isPending}>Generate Payroll</Button>
      </CardContent>
    </Card>
  )
}

function BulkGenerateTab({ departments }: { departments: { id: number; name: string }[] }) {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [deptId, setDeptId] = useState('')
  const [result, setResult] = useState<{ generated: number; errors: { emp_code: string; error: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleBulk() {
    setLoading(true)
    setResult(null)
    try {
      const data = await payrollApi.bulkGenerate({ month, year, department_id: deptId ? Number(deptId) : undefined })
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5 max-w-md space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Department (all if blank)</Label>
          <Select value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <Button onClick={handleBulk} loading={loading}>Generate Bulk Payroll</Button>
        {result && (
          <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
            Generated for {result.generated} employees.
            {result.errors.length > 0 && (
              <div className="mt-1 text-red-600">
                {result.errors.map((e) => <p key={e.emp_code}>{e.emp_code}: {e.error}</p>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PayslipsTab({ payrollList, onDownload, filterMonth, filterYear, setFilterMonth, setFilterYear, myProfile }: {
  payrollList: PayrollRecord[]
  onDownload: (id: number, empCode: string) => void
  filterMonth: number; filterYear: number
  setFilterMonth: (m: number) => void; setFilterYear: (y: number) => void
  myProfile?: Employee
}) {
  const [previewRecord, setPreviewRecord] = useState<PayrollRecord | null>(null)

  return (
    <div>
      {myProfile && <CompensationCard employee={myProfile} />}

      {previewRecord && (
        <PayslipPreviewModal
          record={previewRecord}
          onClose={() => setPreviewRecord(null)}
          onDownload={() => {
            onDownload(previewRecord.id, previewRecord.employee?.emp_code ?? String(previewRecord.employee_id))
          }}
        />
      )}

      <div className="flex gap-3 mb-4">
        <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="w-36">
          {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </Select>
        <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-24">
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>

      {payrollList.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-gray-400">No payslips for this period</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {payrollList.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{MONTHS[p.month - 1]} {p.year}</p>
                  {p.employee && <p className="text-xs text-gray-500">{p.employee.first_name} {p.employee.last_name}</p>}
                  <p className="text-sm mt-1">Net: <span className="font-semibold text-green-600">{formatCurrency(p.net_salary)}</span></p>
                  <Badge variant={p.status === 'finalized' ? 'success' : 'warning'} className="capitalize mt-1">{p.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewRecord(p)}
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDownload(p.id, p.employee?.emp_code ?? String(p.employee_id))}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" /> PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CompensationCard({ employee }: { employee: Employee }) {
  const earnings = employee.salary_breakup?.earnings
    ? Object.entries(employee.salary_breakup.earnings).map(([label, value]) => [label, Number(value) * 12] as const)
    : [
        ['Basic', (Number(employee.basic_salary) || 0) * 12],
        ['HRA', (Number(employee.hra) || 0) * 12],
        ['Special Allowance', (Number(employee.special_allowance) || 0) * 12],
        ['Conveyance', (Number(employee.conveyance_allowance) || 0) * 12],
        ['Medical', (Number(employee.medical_allowance) || 0) * 12],
      ]
  const benefits = employee.salary_breakup?.employer_contributions
    ? Object.entries(employee.salary_breakup.employer_contributions).map(([label, value]) => [label, Number(value) * 12] as const)
    : []
  const grossSalary = employee.salary_breakup?.gross_salary
    ? employee.salary_breakup.gross_salary * 12
    : earnings.reduce((sum, [, value]) => sum + Number(value || 0), 0)

  return (
    <Card className="mb-5">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Wallet className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Annual Compensation</p>
            <p className="text-xs text-gray-500">Your annual salary breakup, benefits, and total CTC.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Earnings</p>
            {earnings.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-medium text-gray-800">{formatCurrency(Number(value) || 0)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-xs font-semibold text-gray-700">Gross Salary</span>
              <span className="text-sm font-bold text-blue-700">{formatCurrency(grossSalary)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Benefits</p>
            {benefits.length > 0 ? benefits.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs font-medium text-emerald-700">{formatCurrency(Number(value) || 0)}</span>
              </div>
            )) : (
              <p className="text-xs text-gray-400">No employer-side benefits configured.</p>
            )}
            {employee.annual_ctc ? (
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-xs font-semibold text-gray-700">Annual CTC</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(Number(employee.annual_ctc))}</span>
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
