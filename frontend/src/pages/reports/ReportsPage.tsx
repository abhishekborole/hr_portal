import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { reportApi, employeeApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatCurrency, MONTHS } from '@/lib/utils'
import { Download } from 'lucide-react'

type TabKey = 'payroll' | 'attendance' | 'leave'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
const now = new Date()

export default function ReportsPage() {
  const [tab, setTab] = useState<TabKey>('payroll')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [deptId, setDeptId] = useState('')

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: employeeApi.departments })

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <PageHeader title="Reports & Analytics" />
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {(['payroll', 'attendance', 'leave'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 capitalize transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t} Report
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        {tab !== 'leave' && (
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </Select>
        )}
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">
          {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
        <Select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-44">
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>

      {tab === 'payroll' && <PayrollReport month={month} year={year} deptId={deptId ? Number(deptId) : undefined} onDownload={(blob) => downloadBlob(blob, `payroll_${year}_${month}.csv`)} />}
      {tab === 'attendance' && <AttendanceReport month={month} year={year} deptId={deptId ? Number(deptId) : undefined} onDownload={(blob) => downloadBlob(blob, `attendance_${year}_${month}.csv`)} />}
      {tab === 'leave' && <LeaveReport year={year} deptId={deptId ? Number(deptId) : undefined} onDownload={(blob) => downloadBlob(blob, `leave_${year}.csv`)} />}
    </div>
  )
}

function PayrollReport({ month, year, deptId, onDownload }: { month: number; year: number; deptId?: number; onDownload: (b: Blob) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-payroll', month, year, deptId],
    queryFn: () => reportApi.payrollSummary(month, year, deptId),
  })

  const records = data?.records ?? []
  const summary = data?.summary

  const chartData = records.slice(0, 10).map((r: { name: string; gross_salary: number; net_salary: number }) => ({
    name: r.name.split(' ')[0],
    gross: r.gross_salary,
    net: r.net_salary,
  }))

  const dedChartData = summary ? [
    { name: 'PF', value: summary.total_pf },
    { name: 'ESIC', value: summary.total_esic },
    { name: 'TDS', value: summary.total_tds },
  ] : []

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <MetricCard label="Employees" value={summary.total_employees} />
          <MetricCard label="Total Gross" value={formatCurrency(summary.total_gross)} />
          <MetricCard label="Total Net" value={formatCurrency(summary.total_net)} highlight />
          <MetricCard label="Total TDS" value={formatCurrency(summary.total_tds)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Card>
          <CardHeader><CardTitle>Gross vs Net by Employee</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                  <Legend />
                  <Bar dataKey="gross" fill="#93c5fd" radius={[2, 2, 0, 0]} name="Gross" />
                  <Bar dataKey="net" fill="#3b82f6" radius={[2, 2, 0, 0]} name="Net" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 py-10 text-center">No data</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Deductions Breakdown</CardTitle></CardHeader>
          <CardContent>
            {dedChartData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={dedChartData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {dedChartData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 py-10 text-center">No data</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payroll Details</CardTitle>
            <Button variant="outline" size="sm" onClick={async () => onDownload(await reportApi.payrollCsv(month, year, deptId))}>
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-sm text-gray-400">Loading...</div> : records.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">No data</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {['Code', 'Name', 'Department', 'Gross', 'PF', 'ESIC', 'PT', 'TDS', 'Net', 'Status'].map((h) => (
                    <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${h === 'Code' || h === 'Name' || h === 'Department' || h === 'Status' ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {records.map((r: { emp_code: string; name: string; department: string; gross_salary: number; pf_employee: number; esic_employee: number; professional_tax: number; tds: number; net_salary: number; status: string }, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.emp_code}</td>
                      <td className="py-2.5 px-4 font-medium">{r.name}</td>
                      <td className="py-2.5 px-4 text-gray-500">{r.department}</td>
                      <td className="py-2.5 px-4 text-right">{formatCurrency(r.gross_salary)}</td>
                      <td className="py-2.5 px-4 text-right text-red-500">{formatCurrency(r.pf_employee)}</td>
                      <td className="py-2.5 px-4 text-right text-red-500">{formatCurrency(r.esic_employee)}</td>
                      <td className="py-2.5 px-4 text-right text-red-500">{formatCurrency(r.professional_tax)}</td>
                      <td className="py-2.5 px-4 text-right text-red-500">{formatCurrency(r.tds)}</td>
                      <td className="py-2.5 px-4 text-right font-semibold text-green-600">{formatCurrency(r.net_salary)}</td>
                      <td className="py-2.5 px-4 capitalize text-gray-500">{r.status}</td>
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

function AttendanceReport({ month, year, deptId, onDownload }: { month: number; year: number; deptId?: number; onDownload: (b: Blob) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-attendance', month, year, deptId],
    queryFn: () => reportApi.attendanceSummary(month, year, deptId),
  })
  const records = data?.records ?? []

  const chartData = records.slice(0, 12).map((r: { name: string; present: number; absent: number; half_day: number }) => ({
    name: r.name.split(' ')[0],
    present: r.present,
    absent: r.absent,
    half_day: r.half_day,
  }))

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Attendance by Employee</CardTitle>
            <Button variant="outline" size="sm" onClick={async () => onDownload(await reportApi.attendanceCsv(month, year, deptId))}>
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="#10b981" stackId="a" name="Present" />
                <Bar dataKey="half_day" fill="#f59e0b" stackId="a" name="Half Day" />
                <Bar dataKey="absent" fill="#ef4444" stackId="a" name="Absent" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-8 text-center">No data</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-sm text-gray-400">Loading...</div> : records.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">No data</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {['Code', 'Name', 'Department', 'Present', 'Absent', 'Half Day', 'Holiday', 'Weekend', 'Total'].map((h) => (
                    <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${['Code', 'Name', 'Department'].includes(h) ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {records.map((r: { emp_code: string; name: string; department: string; present: number; absent: number; half_day: number; holiday: number; weekend: number; total_marked: number }, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.emp_code}</td>
                      <td className="py-2.5 px-4 font-medium">{r.name}</td>
                      <td className="py-2.5 px-4 text-gray-500">{r.department}</td>
                      <td className="py-2.5 px-4 text-center text-green-600 font-medium">{r.present}</td>
                      <td className="py-2.5 px-4 text-center text-red-500">{r.absent}</td>
                      <td className="py-2.5 px-4 text-center text-yellow-600">{r.half_day}</td>
                      <td className="py-2.5 px-4 text-center text-blue-500">{r.holiday}</td>
                      <td className="py-2.5 px-4 text-center text-gray-400">{r.weekend}</td>
                      <td className="py-2.5 px-4 text-center font-medium">{r.total_marked}</td>
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

function LeaveReport({ year, deptId, onDownload }: { year: number; deptId?: number; onDownload: (b: Blob) => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-leave', year, deptId],
    queryFn: () => reportApi.leaveSummary(year, deptId),
  })
  const records = data?.records ?? []

  const chartData = records.slice(0, 12).map((r: { name: string; CL: number; SL: number; EL: number; LOP: number }) => ({
    name: r.name.split(' ')[0],
    CL: r.CL, SL: r.SL, EL: r.EL, LOP: r.LOP,
  }))

  return (
    <div>
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Leave Distribution {year}</CardTitle>
            <Button variant="outline" size="sm" onClick={async () => onDownload(await reportApi.leaveCsv(year, deptId))}>
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip /><Legend />
                <Bar dataKey="CL" fill="#3b82f6" stackId="a" name="CL" />
                <Bar dataKey="SL" fill="#10b981" stackId="a" name="SL" />
                <Bar dataKey="EL" fill="#f59e0b" stackId="a" name="EL" />
                <Bar dataKey="LOP" fill="#ef4444" stackId="a" name="LOP" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-8 text-center">No data</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="py-8 text-center text-sm text-gray-400">Loading...</div> : records.length === 0 ? <div className="py-8 text-center text-sm text-gray-400">No approved leaves for {year}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100 bg-gray-50">
                  {['Code', 'Name', 'Department', 'CL Used', 'SL Used', 'EL Used', 'LOP', 'Total', 'CL Bal', 'SL Bal', 'EL Bal'].map((h) => (
                    <th key={h} className={`py-3 px-4 text-xs font-medium text-gray-500 ${['Code', 'Name', 'Department'].includes(h) ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {records.map((r: { emp_code: string; name: string; department: string; CL: number; SL: number; EL: number; LOP: number; total: number; cl_balance: number; sl_balance: number; el_balance: number }, i: number) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-500">{r.emp_code}</td>
                      <td className="py-2.5 px-4 font-medium">{r.name}</td>
                      <td className="py-2.5 px-4 text-gray-500">{r.department}</td>
                      <td className="py-2.5 px-4 text-center">{r.CL}</td>
                      <td className="py-2.5 px-4 text-center">{r.SL}</td>
                      <td className="py-2.5 px-4 text-center">{r.EL}</td>
                      <td className="py-2.5 px-4 text-center text-red-500">{r.LOP}</td>
                      <td className="py-2.5 px-4 text-center font-medium">{r.total}</td>
                      <td className="py-2.5 px-4 text-center text-green-600">{r.cl_balance}</td>
                      <td className="py-2.5 px-4 text-center text-green-600">{r.sl_balance}</td>
                      <td className="py-2.5 px-4 text-center text-green-600">{r.el_balance}</td>
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

function MetricCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold mt-1 ${highlight ? 'text-green-600' : 'text-gray-900'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
