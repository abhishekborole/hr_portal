import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attendanceApi, employeeApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

type TabKey = 'log' | 'mark' | 'calendar' | 'holidays'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  half_day: 'bg-yellow-100 text-yellow-700',
  holiday: 'bg-blue-100 text-blue-700',
  weekend: 'bg-gray-100 text-gray-500',
  lop: 'bg-orange-100 text-orange-700',
}

const now = new Date()
const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

export default function AttendancePage() {
  const { user, isAdmin, isManager } = useAuth()
  const isAdminOrManager = isAdmin || isManager
  const [tab, setTab] = useState<TabKey>('log')
  const [filterEmpId, setFilterEmpId] = useState('')
  const [filterMonth, setFilterMonth] = useState(prevMonth.getMonth() + 1)
  const [filterYear, setFilterYear] = useState(prevMonth.getFullYear())

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', { is_active: true }],
    queryFn: () => employeeApi.list({ is_active: true }),
    enabled: isAdminOrManager,
  })

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance', { employee_id: filterEmpId ? Number(filterEmpId) : undefined, month: filterMonth, year: filterYear }],
    queryFn: () => attendanceApi.list({
      employee_id: isAdminOrManager ? (filterEmpId ? Number(filterEmpId) : undefined) : user!.employee_id!,
      month: filterMonth,
      year: filterYear,
    }),
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', filterYear],
    queryFn: () => attendanceApi.holidays(filterYear),
    enabled: tab === 'holidays',
  })

  const tabs: { key: TabKey; label: string }[] = isAdminOrManager
    ? [
        { key: 'log', label: 'Attendance Log' },
        { key: 'mark', label: 'Bulk Mark' },
        { key: 'calendar', label: 'Calendar View' },
        { key: 'holidays', label: 'Holidays' },
      ]
    : [
        { key: 'log', label: 'My Attendance' },
        { key: 'mark', label: 'Mark Attendance' },
        { key: 'calendar', label: 'Calendar View' },
      ]

  return (
    <div>
      <PageHeader title="Attendance" />
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

      {tab === 'log' && (
        <div>
          <div className="flex gap-3 mb-4 flex-wrap">
            {isAdminOrManager && (
              <Select value={filterEmpId} onChange={(e) => setFilterEmpId(e.target.value)} className="w-52">
                <option value="">All Employees</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </Select>
            )}
            <Select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="w-36">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
              ))}
            </Select>
            <Select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="w-24">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
              ) : attendance.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No records for this period</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Date</th>
                        {isAdminOrManager && <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Employee</th>}
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Check In</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Check Out</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Hours</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((a) => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 px-4">{formatDate(a.date)}</td>
                          {isAdminOrManager && (
                            <td className="py-2.5 px-4">{a.employee ? `${a.employee.first_name} ${a.employee.last_name}` : `#${a.employee_id}`}</td>
                          )}
                          <td className="py-2.5 px-4 font-mono text-xs">{a.check_in ?? '—'}</td>
                          <td className="py-2.5 px-4 font-mono text-xs">{a.check_out ?? '—'}</td>
                          <td className="py-2.5 px-4">{a.working_hours ? `${a.working_hours}h` : '—'}</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {a.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-gray-500">{a.remarks ?? '—'}</td>
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

      {tab === 'mark' && (
        isAdminOrManager
          ? <BulkMarkTab employees={employees} />
          : <SingleMarkTab employeeId={user!.employee_id!} />
      )}

      {tab === 'calendar' && (
        <CalendarView
          attendance={attendance}
          month={filterMonth}
          year={filterYear}
          onMonthChange={setFilterMonth}
          onYearChange={setFilterYear}
        />
      )}

      {tab === 'holidays' && (
        <Card>
          <CardHeader><CardTitle>Holidays {filterYear}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Holiday</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Type</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id} className="border-b border-gray-50">
                    <td className="py-2.5 px-4 font-medium">{h.name}</td>
                    <td className="py-2.5 px-4 text-gray-600">{formatDate(h.date)}</td>
                    <td className="py-2.5 px-4"><Badge variant="secondary" className="capitalize">{h.holiday_type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SingleMarkTab({ employeeId }: { employeeId: number }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [status, setStatus] = useState('present')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [remarks, setRemarks] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => attendanceApi.mark({ employee_id: employeeId, date, status, check_in: checkIn || undefined, check_out: checkOut || undefined, remarks: remarks || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setSuccess('Attendance marked')
      setTimeout(() => setSuccess(''), 3000)
    },
    onError: () => setError('Failed to mark attendance'),
  })

  return (
    <Card>
      <CardContent className="p-5 max-w-sm space-y-4">
        {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
        {success && <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{success}</div>}
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="half_day">Half Day</option>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Check In (HH:MM)</Label><Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Check Out (HH:MM)</Label><Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Remarks</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Mark Attendance</Button>
      </CardContent>
    </Card>
  )
}

function BulkMarkTab({ employees }: { employees: { id: number; first_name: string; last_name: string }[] }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [records, setRecords] = useState<Record<number, { status: string; check_in: string; check_out: string; remarks: string }>>({})
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  function update(empId: number, field: string, value: string) {
    setRecords((prev) => ({ ...prev, [empId]: { ...(prev[empId] ?? { status: 'present', check_in: '', check_out: '', remarks: '' }), [field]: value } }))
  }

  const mutation = useMutation({
    mutationFn: () => attendanceApi.bulkMark({
      date,
      records: employees.slice(0, 30).map((e) => ({
        employee_id: e.id,
        status: records[e.id]?.status ?? 'present',
        check_in: records[e.id]?.check_in || undefined,
        check_out: records[e.id]?.check_out || undefined,
        remarks: records[e.id]?.remarks || undefined,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setSuccess(`Marked for ${Math.min(employees.length, 30)} employees`)
      setTimeout(() => setSuccess(''), 4000)
    },
    onError: () => setError('Bulk mark failed'),
  })

  return (
    <div>
      <div className="flex gap-3 items-end mb-4">
        <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" /></div>
        <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Save All</Button>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-600">{success}</div>}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 w-48">Employee</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 w-36">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 w-28">Check In</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 w-28">Check Out</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {employees.slice(0, 30).map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="py-2 px-4 font-medium">{e.first_name} {e.last_name}</td>
                    <td className="py-2 px-4">
                      <Select value={records[e.id]?.status ?? 'present'} onChange={(ev) => update(e.id, 'status', ev.target.value)} className="h-8 text-xs">
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="half_day">Half Day</option>
                        <option value="holiday">Holiday</option>
                        <option value="weekend">Weekend</option>
                        <option value="lop">LOP</option>
                      </Select>
                    </td>
                    <td className="py-2 px-4"><Input type="time" value={records[e.id]?.check_in ?? ''} onChange={(ev) => update(e.id, 'check_in', ev.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-2 px-4"><Input type="time" value={records[e.id]?.check_out ?? ''} onChange={(ev) => update(e.id, 'check_out', ev.target.value)} className="h-8 text-xs" /></td>
                    <td className="py-2 px-4"><Input value={records[e.id]?.remarks ?? ''} onChange={(ev) => update(e.id, 'remarks', ev.target.value)} className="h-8 text-xs" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CalendarView({ attendance, month, year, onMonthChange, onYearChange }: {
  attendance: { date: string; status: string }[]
  month: number; year: number
  onMonthChange: (m: number) => void
  onYearChange: (y: number) => void
}) {
  const statusMap: Record<string, string> = {}
  attendance.forEach((a) => { statusMap[a.date] = a.status })

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</CardTitle>
          <div className="flex gap-2">
            <Select value={month} onChange={(e) => onMonthChange(Number(e.target.value))} className="w-32 h-8 text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}</option>
              ))}
            </Select>
            <Select value={year} onChange={(e) => onYearChange(Number(e.target.value))} className="w-20 h-8 text-sm">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />
            const ds = dateStr(day)
            const status = statusMap[ds]
            return (
              <div key={day} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium ${status ? STATUS_COLORS[status] : 'bg-gray-50 text-gray-700'}`}>
                <span>{day}</span>
                {status && <span className="text-[9px] leading-tight capitalize">{status.replace('_', ' ')}</span>}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(STATUS_COLORS).map(([s, cls]) => (
            <span key={s} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s.replace('_', ' ')}</span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
