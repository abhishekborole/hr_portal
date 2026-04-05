import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { employeeApi, positionApi, salaryStructureApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import type { Position } from '@/types'

type TabKey = 'dashboard' | 'open_positions' | 'create_position'

const emptyForm = {
  title: '',
  department_id: '',
  employment_type: 'permanent',
  location: '',
  openings: '1',
  status: 'open',
  description: '',
}

const emptyHireForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_joining: '',
  designation: '',
  annual_ctc: '',
  structure_id: '',
}

function lifecycleBadge(stage?: string) {
  if (stage === 'active') return 'success'
  if (stage === 'onboarding') return 'warning'
  return 'secondary'
}

function lifecycleLabel(stage?: string) {
  if (stage === 'active') return 'Active'
  if (stage === 'onboarding') return 'Onboarding'
  return 'Hiring'
}

function statusBadge(status?: Position['status']) {
  if (status === 'open') return 'success'
  if (status === 'on_hold') return 'warning'
  return 'secondary'
}

function statusLabel(status?: Position['status']) {
  if (status === 'on_hold') return 'On Hold'
  if (status === 'closed') return 'Closed'
  return 'Open'
}

export default function PositionsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { slug } = useParams()
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [form, setForm] = useState(emptyForm)
  const [hireForm, setHireForm] = useState(emptyHireForm)
  const [editing, setEditing] = useState<Position | null>(null)
  const [hirePosition, setHirePosition] = useState<Position | null>(null)
  const [feedback, setFeedback] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    department_id: '',
    employment_type: '',
    location: '',
    vacancy_state: '',
    staffing_state: '',
    pipeline_stage: '',
  })

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: employeeApi.departments })
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => positionApi.list() })
  const { data: structures = [] } = useQuery({ queryKey: ['salary-structures'], queryFn: salaryStructureApi.list })

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) => {
      const data = {
        title: payload.title,
        department_id: payload.department_id ? Number(payload.department_id) : undefined,
        employment_type: payload.employment_type,
        location: payload.location || undefined,
        openings: payload.openings ? Number(payload.openings) : 1,
        status: payload.status,
        description: payload.description || undefined,
      }
      return editing ? positionApi.update(editing.id, data) : positionApi.create(data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      setFeedback(editing ? 'Position updated' : 'Position created')
      setEditing(null)
      setForm(emptyForm)
      setTab('open_positions')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => positionApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      setFeedback('Position deleted')
    },
  })

  const hireMutation = useMutation({
    mutationFn: ({ positionId, payload }: { positionId: number; payload: typeof emptyHireForm }) =>
      positionApi.createHire(positionId, {
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email,
        phone: payload.phone || undefined,
        date_of_joining: payload.date_of_joining,
        designation: payload.designation || undefined,
        annual_ctc: payload.annual_ctc ? Number(payload.annual_ctc) : undefined,
        structure_id: payload.structure_id ? Number(payload.structure_id) : undefined,
      }),
    onSuccess: (employee) => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      setHirePosition(null)
      setHireForm(emptyHireForm)
      setFeedback(`Hire created for ${employee.first_name} ${employee.last_name}`)
      if (slug) navigate(`/${slug}/employees?tab=onboarding&employeeId=${employee.id}`)
    },
  })

  const metrics = useMemo(() => {
    const openPositions = positions.filter((position) => position.status === 'open').length
    const onHoldPositions = positions.filter((position) => position.status === 'on_hold').length
    const totalVacancies = positions.reduce((sum, position) => sum + position.open_vacancies, 0)
    const hiringInProgress = positions.reduce((sum, position) => sum + position.hiring_count, 0)
    const activePlacements = positions.reduce((sum, position) => sum + position.active_employee_count, 0)
    return { openPositions, onHoldPositions, totalVacancies, hiringInProgress, activePlacements }
  }, [positions])

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      const searchNeedle = filters.search.toLowerCase()
      const searchMatch = !searchNeedle || position.title.toLowerCase().includes(searchNeedle) || (position.description || '').toLowerCase().includes(searchNeedle)
      const statusMatch = !filters.status || position.status === filters.status
      const departmentMatch = !filters.department_id || String(position.department_id || '') === filters.department_id
      const employmentTypeMatch = !filters.employment_type || position.employment_type === filters.employment_type
      const locationMatch = !filters.location || (position.location || '').toLowerCase().includes(filters.location.toLowerCase())
      const vacancyMatch = !filters.vacancy_state || (filters.vacancy_state === 'has_vacancy' ? position.open_vacancies > 0 : position.open_vacancies === 0)
      const staffingMatch =
        !filters.staffing_state ||
        (filters.staffing_state === 'unfilled' && position.filled_count === 0) ||
        (filters.staffing_state === 'partially_filled' && position.filled_count > 0 && position.open_vacancies > 0) ||
        (filters.staffing_state === 'fully_staffed' && position.open_vacancies === 0)
      const pipelineMatch = !filters.pipeline_stage || position.linked_hires.some((hire) => hire.lifecycle_stage === filters.pipeline_stage)
      return searchMatch && statusMatch && departmentMatch && employmentTypeMatch && locationMatch && vacancyMatch && staffingMatch && pipelineMatch
    })
  }, [filters, positions])

  function openEdit(position: Position) {
    setEditing(position)
    setForm({
      title: position.title,
      department_id: position.department_id ? String(position.department_id) : '',
      employment_type: position.employment_type || 'permanent',
      location: position.location || '',
      openings: String(position.openings || 1),
      status: position.status || 'open',
      description: position.description || '',
    })
    setTab('create_position')
  }

  function resetForm() {
    setEditing(null)
    setForm(emptyForm)
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'open_positions', label: 'Open Positions' },
    { key: 'create_position', label: editing ? 'Edit Position' : 'Create New Position' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader title="Positions" subtitle="Manage headcount, track role-wise hiring, and start onboarding from the position itself." />
      <div className="-mt-2 overflow-hidden rounded-t-2xl border border-[#29486d] bg-[#1e3a5f] shadow-sm">
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setTab(item.key)
                if (item.key === 'create_position' && !editing) resetForm()
              }}
              className={`border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                tab === item.key ? 'border-sky-300 bg-[#355783] text-white' : 'border-transparent text-blue-100 hover:bg-[#2b4a74] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {feedback && <div className="border-x border-b border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{feedback}</div>}

      {tab === 'dashboard' && (
        <div className="space-y-6 rounded-b-2xl border-x border-b border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Open Positions" value={metrics.openPositions} tone="green" />
            <MetricCard label="On Hold" value={metrics.onHoldPositions} tone="amber" />
            <MetricCard label="Open Vacancies" value={metrics.totalVacancies} tone="rose" />
            <MetricCard label="Hiring In Progress" value={metrics.hiringInProgress} tone="blue" />
            <MetricCard label="Active Placements" value={metrics.activePlacements} tone="teal" />
          </div>

          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Priority Positions</p>
                  <p className="mt-1 text-xs text-gray-500">Roles with live vacancies or hiring activity.</p>
                </div>
                <Button variant="outline" onClick={() => setTab('open_positions')}>View All</Button>
              </div>
              <div className="space-y-3">
                {positions
                  .slice()
                  .sort((a, b) => (b.open_vacancies + b.hiring_count) - (a.open_vacancies + a.hiring_count))
                  .slice(0, 6)
                  .map((position) => (
                    <div key={position.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{position.title}</p>
                          <p className="mt-1 text-xs text-gray-500">{position.department?.name || 'No department'} · {position.location || 'Location not set'}</p>
                        </div>
                        <Badge variant={statusBadge(position.status)}>{statusLabel(position.status)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>Vacancies: {position.open_vacancies}</span>
                        <span>Hiring: {position.hiring_count}</span>
                        <span>Active: {position.active_employee_count}</span>
                      </div>
                    </div>
                  ))}
                {positions.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">No positions found.</div>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'open_positions' && (
        <Card className="rounded-t-none border-gray-200 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Open Positions</p>
                <p className="mt-1 text-xs text-gray-500">Review vacancies, inspect pipeline, and create the next hire from the role card.</p>
              </div>
              <Button onClick={() => { resetForm(); setTab('create_position') }}>
                <Plus className="h-4 w-4" /> New Position
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.2fr_0.8fr]">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filters</p>
                  <button
                    onClick={() => setFilters({ search: '', status: '', department_id: '', employment_type: '', location: '', vacancy_state: '', staffing_state: '', pipeline_stage: '' })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-4">
                  <FormField label="Search"><Input value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="Title or description" /></FormField>
                  <FormField label="Status">
                    <Select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                      <option value="">All</option>
                      <option value="open">Open</option>
                      <option value="on_hold">On Hold</option>
                      <option value="closed">Closed</option>
                    </Select>
                  </FormField>
                  <FormField label="Department">
                    <Select value={filters.department_id} onChange={(e) => setFilters((prev) => ({ ...prev, department_id: e.target.value }))}>
                      <option value="">All</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </Select>
                  </FormField>
                  <FormField label="Employment Type">
                    <Select value={filters.employment_type} onChange={(e) => setFilters((prev) => ({ ...prev, employment_type: e.target.value }))}>
                      <option value="">All</option>
                      <option value="permanent">Permanent</option>
                      <option value="contractor">Contractor</option>
                      <option value="trainee">Trainee</option>
                      <option value="intern">Intern</option>
                    </Select>
                  </FormField>
                  <FormField label="Location"><Input value={filters.location} onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))} placeholder="City or location" /></FormField>
                  <FormField label="Vacancy State">
                    <Select value={filters.vacancy_state} onChange={(e) => setFilters((prev) => ({ ...prev, vacancy_state: e.target.value }))}>
                      <option value="">All</option>
                      <option value="has_vacancy">Has Vacancy</option>
                      <option value="no_vacancy">No Vacancy</option>
                    </Select>
                  </FormField>
                  <FormField label="Staffing State">
                    <Select value={filters.staffing_state} onChange={(e) => setFilters((prev) => ({ ...prev, staffing_state: e.target.value }))}>
                      <option value="">All</option>
                      <option value="unfilled">Unfilled</option>
                      <option value="partially_filled">Partially Filled</option>
                      <option value="fully_staffed">Fully Staffed</option>
                    </Select>
                  </FormField>
                  <FormField label="Pipeline Stage">
                    <Select value={filters.pipeline_stage} onChange={(e) => setFilters((prev) => ({ ...prev, pipeline_stage: e.target.value }))}>
                      <option value="">All</option>
                      <option value="hiring">Hiring</option>
                      <option value="onboarding">Onboarding</option>
                      <option value="active">Active</option>
                    </Select>
                  </FormField>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  <span>Matching Positions</span>
                  <span className="font-semibold text-gray-900">{filteredPositions.length}</span>
                </div>
                {filteredPositions.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
                    No positions match the selected filters.
                  </div>
                )}
                {filteredPositions.map((position) => (
                  <div key={position.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{position.title}</p>
                        <p className="mt-1 text-xs text-gray-500">{position.department?.name || 'No department'} · {position.location || 'Location not set'}</p>
                        {position.description && <p className="mt-2 text-sm text-gray-600">{position.description}</p>}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusBadge(position.status)}>{statusLabel(position.status)}</Badge>
                        <Badge variant="secondary">{position.open_vacancies} vacancies</Badge>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 md:grid-cols-6">
                      <span>Type: <span className="font-medium text-gray-800">{position.employment_type || 'permanent'}</span></span>
                      <span>Openings: <span className="font-medium text-gray-800">{position.openings || 0}</span></span>
                      <span>Filled: <span className="font-medium text-gray-800">{position.filled_count}</span></span>
                      <span>Hiring: <span className="font-medium text-gray-800">{position.hiring_count}</span></span>
                      <span>Active: <span className="font-medium text-gray-800">{position.active_employee_count}</span></span>
                      <span>Created: <span className="font-medium text-gray-800">{formatDate(position.created_at)}</span></span>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hiring Pipeline</p>
                          <p className="mt-1 text-xs text-slate-500">People hired or being onboarded against this role.</p>
                        </div>
                        <Button size="sm" onClick={() => { setHirePosition(position); setHireForm({ ...emptyHireForm, designation: position.title }) }} disabled={position.status !== 'open' || position.open_vacancies <= 0}>
                          <UserPlus className="h-3.5 w-3.5" /> Hire Against Position
                        </Button>
                      </div>
                      <div className="mt-3 space-y-2">
                        {position.linked_hires.length === 0 && (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                            No hires started against this position yet.
                          </div>
                        )}
                        {position.linked_hires.map((hire) => (
                          <div key={hire.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{hire.first_name} {hire.last_name}</p>
                              <p className="mt-1 text-xs text-slate-500">{hire.emp_code} · {hire.email}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={lifecycleBadge(hire.lifecycle_stage)}>{lifecycleLabel(hire.lifecycle_stage)}</Badge>
                              <Badge variant="secondary">{hire.offer_status}</Badge>
                              <span className="text-xs text-slate-500">Joining {formatDate(hire.date_of_joining)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(position)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteMutation.mutate(position.id)} loading={deleteMutation.isPending}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'create_position' && (
        <Card className="rounded-t-none border-gray-200 shadow-sm">
          <CardContent className="p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{editing ? 'Edit Position' : 'Create New Position'}</p>
                <p className="mt-1 text-xs text-gray-500">Define headcount once, then hire and onboard people directly against the approved role.</p>
              </div>
              {editing && <Button variant="outline" onClick={() => { resetForm(); setTab('open_positions') }}>Cancel Edit</Button>}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField label="Title"><Input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></FormField>
              <FormField label="Department">
                <Select value={form.department_id} onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}>
                  <option value="">Select</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Employment Type">
                <Select value={form.employment_type} onChange={(e) => setForm((prev) => ({ ...prev, employment_type: e.target.value }))}>
                  <option value="permanent">Permanent</option>
                  <option value="contractor">Contractor</option>
                  <option value="trainee">Trainee</option>
                  <option value="intern">Intern</option>
                </Select>
              </FormField>
              <FormField label="Location"><Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} /></FormField>
              <FormField label="Openings"><Input type="number" value={form.openings} onChange={(e) => setForm((prev) => ({ ...prev, openings: e.target.value }))} /></FormField>
              <FormField label="Status">
                <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>
                  <option value="open">Open</option>
                  <option value="on_hold">On Hold</option>
                  <option value="closed">Closed</option>
                </Select>
              </FormField>
              <FormField label="Description" className="md:col-span-2"><Input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></FormField>
            </div>
            <div className="mt-5 flex gap-2">
              <Button onClick={() => saveMutation.mutate(form)} loading={saveMutation.isPending} disabled={!form.title.trim()}>
                <Plus className="h-4 w-4" /> {editing ? 'Save Position' : 'Create Position'}
              </Button>
              <Button variant="outline" onClick={resetForm}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {hirePosition && (
        <HireModal
          position={hirePosition}
          structures={structures.filter((structure) => structure.is_active)}
          values={hireForm}
          onClose={() => { setHirePosition(null); setHireForm(emptyHireForm) }}
          onChange={(field, value) => setHireForm((prev) => ({ ...prev, [field]: value }))}
          onSubmit={() => hireMutation.mutate({ positionId: hirePosition.id, payload: hireForm })}
          isSubmitting={hireMutation.isPending}
        />
      )}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'green' | 'amber' | 'rose' | 'blue' | 'teal' }) {
  const toneMap = {
    green: 'border-green-100 bg-green-50 text-green-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
    teal: 'border-teal-100 bg-teal-50 text-teal-700',
  }
  return <Card className={toneMap[tone]}><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>
}

function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1.5 ${className ?? ''}`}><Label className="text-xs">{label}</Label>{children}</div>
}

function HireModal({ position, structures, values, onClose, onChange, onSubmit, isSubmitting }: { position: Position; structures: Array<{ id: number; name: string }>; values: typeof emptyHireForm; onClose: () => void; onChange: (field: keyof typeof emptyHireForm, value: string) => void; onSubmit: () => void; isSubmitting: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Hire Against Position</p>
            <p className="mt-1 text-xs text-gray-500">Create the pre-hire record from <span className="font-semibold text-gray-700">{position.title}</span> and continue onboarding from there.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-5 px-6 py-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Position Snapshot</p>
            <div className="mt-3 space-y-2">
              <p><span className="font-medium text-slate-900">Role:</span> {position.title}</p>
              <p><span className="font-medium text-slate-900">Department:</span> {position.department?.name || 'No department'}</p>
              <p><span className="font-medium text-slate-900">Location:</span> {position.location || 'Location not set'}</p>
              <p><span className="font-medium text-slate-900">Open Vacancies:</span> {position.open_vacancies}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="First Name"><Input value={values.first_name} onChange={(e) => onChange('first_name', e.target.value)} /></FormField>
            <FormField label="Last Name"><Input value={values.last_name} onChange={(e) => onChange('last_name', e.target.value)} /></FormField>
            <FormField label="Email"><Input type="email" value={values.email} onChange={(e) => onChange('email', e.target.value)} /></FormField>
            <FormField label="Phone"><Input value={values.phone} onChange={(e) => onChange('phone', e.target.value)} /></FormField>
            <FormField label="Joining Date"><Input type="date" value={values.date_of_joining} onChange={(e) => onChange('date_of_joining', e.target.value)} /></FormField>
            <FormField label="Designation"><Input value={values.designation} onChange={(e) => onChange('designation', e.target.value)} /></FormField>
            <FormField label="Annual CTC (Rs)"><Input type="number" value={values.annual_ctc} onChange={(e) => onChange('annual_ctc', e.target.value)} /></FormField>
            <FormField label="Salary Structure">
              <Select value={values.structure_id} onChange={(e) => onChange('structure_id', e.target.value)}>
                <option value="">Select</option>
                {structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}
              </Select>
            </FormField>
          </div>
        </div>
        {values.annual_ctc && <div className="border-t border-gray-100 px-6 py-3 text-sm text-gray-600">Compensation snapshot: <span className="font-semibold text-gray-900">{formatCurrency(Number(values.annual_ctc || 0))}</span> annual CTC</div>}
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} loading={isSubmitting} disabled={!values.first_name || !values.last_name || !values.email || !values.date_of_joining}>
            <UserPlus className="h-4 w-4" /> Create Hire And Open Onboarding
          </Button>
        </div>
      </div>
    </div>
  )
}
