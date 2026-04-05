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
import { employeeApi, hiringApi, positionApi, salaryStructureApi } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Eye, FileDown, Pencil, Plus, Trash2, UserCheck, X } from 'lucide-react'
import type { Candidate, OnboardingRecord, Position } from '@/types'

type TabKey = 'dashboard' | 'positions' | 'candidates' | 'offers' | 'onboarding' | 'position_form'

const emptyPositionForm = { title: '', department_id: '', employment_type: 'permanent', location: '', openings: '1', status: 'open', description: '' }
const emptyCandidateForm = { position_id: '', first_name: '', last_name: '', email: '', phone: '', source: '', stage: 'applied', current_ctc: '', expected_ctc: '', notice_period_days: '', proposed_joining_date: '', designation: '', notes: '' }
const emptyOfferForm = { candidate_id: '', annual_ctc: '', structure_id: '', joining_date: '', reporting_manager: '', work_location: '', probation_months: '6', additional_terms: '' }
const emptyConvertForm = { emp_code: '', phone: '', date_of_birth: '', pan: '', aadhaar: '', uan: '', bank_account: '', ifsc_code: '', bank_name: '', address: '', city: '', state: '', pincode: '' }
const emptyPositionFilters = { search: '', status: '', department_id: '', employment_type: '', location: '', vacancy_state: '', staffing_state: '' }

function badge(status?: string) {
  if (['open', 'accepted', 'active', 'completed', 'joined'].includes(status || '')) return 'success'
  if (['on_hold', 'released', 'in_progress', 'onboarding', 'screening', 'interview'].includes(status || '')) return 'warning'
  if (['cancelled', 'onboarding_cancelled'].includes(status || '')) return 'secondary'
  return 'secondary'
}

function positionCodeLabel(position?: Pick<Position, 'id' | 'code'> | null) {
  if (!position) return 'No ID'
  if (position.code) return position.code
  return `POS-${String(position.id).padStart(4, '0')}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function HiringWorkspacePage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { slug } = useParams()
  const [tab, setTab] = useState<TabKey>('dashboard')
  const [positionForm, setPositionForm] = useState(emptyPositionForm)
  const [candidateForm, setCandidateForm] = useState(emptyCandidateForm)
  const [offerForm, setOfferForm] = useState(emptyOfferForm)
  const [convertForm, setConvertForm] = useState(emptyConvertForm)
  const [positionFilters, setPositionFilters] = useState(emptyPositionFilters)
  const [feedback, setFeedback] = useState('')
  const [editingPosition, setEditingPosition] = useState<Position | null>(null)
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null)
  const [selectedOnboarding, setSelectedOnboarding] = useState<OnboardingRecord | null>(null)

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: employeeApi.departments })
  const { data: positions = [] } = useQuery({ queryKey: ['positions'], queryFn: () => positionApi.list() })
  const { data: candidates = [] } = useQuery({ queryKey: ['candidates'], queryFn: hiringApi.listCandidates })
  const { data: offers = [] } = useQuery({ queryKey: ['offers'], queryFn: hiringApi.listOffers })
  const { data: onboarding = [] } = useQuery({ queryKey: ['onboarding-records'], queryFn: hiringApi.listOnboarding })
  const { data: structures = [] } = useQuery({ queryKey: ['salary-structures'], queryFn: salaryStructureApi.list })

  const positionMutation = useMutation({
    mutationFn: () => editingPosition
      ? positionApi.update(editingPosition.id, { title: positionForm.title, department_id: positionForm.department_id ? Number(positionForm.department_id) : undefined, employment_type: positionForm.employment_type, location: positionForm.location || undefined, openings: Number(positionForm.openings || 1), status: positionForm.status, description: positionForm.description || undefined })
      : positionApi.create({ title: positionForm.title, department_id: positionForm.department_id ? Number(positionForm.department_id) : undefined, employment_type: positionForm.employment_type, location: positionForm.location || undefined, openings: Number(positionForm.openings || 1), status: positionForm.status, description: positionForm.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['positions'] })
      setFeedback(editingPosition ? 'Position updated' : 'Position created')
      setEditingPosition(null)
      setPositionForm(emptyPositionForm)
      setTab('positions')
    },
  })

  const deletePositionMutation = useMutation({ mutationFn: (id: number) => positionApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }) })

  const candidateMutation = useMutation({
    mutationFn: () => editingCandidate
      ? hiringApi.updateCandidate(editingCandidate.id, { first_name: candidateForm.first_name, last_name: candidateForm.last_name, email: candidateForm.email, phone: candidateForm.phone || undefined, source: candidateForm.source || undefined, stage: candidateForm.stage, current_ctc: candidateForm.current_ctc ? Number(candidateForm.current_ctc) : undefined, expected_ctc: candidateForm.expected_ctc ? Number(candidateForm.expected_ctc) : undefined, notice_period_days: candidateForm.notice_period_days ? Number(candidateForm.notice_period_days) : undefined, proposed_joining_date: candidateForm.proposed_joining_date || undefined, designation: candidateForm.designation || undefined, notes: candidateForm.notes || undefined })
      : hiringApi.createCandidate({ position_id: Number(candidateForm.position_id), first_name: candidateForm.first_name, last_name: candidateForm.last_name, email: candidateForm.email, phone: candidateForm.phone || undefined, source: candidateForm.source || undefined, stage: candidateForm.stage, current_ctc: candidateForm.current_ctc ? Number(candidateForm.current_ctc) : undefined, expected_ctc: candidateForm.expected_ctc ? Number(candidateForm.expected_ctc) : undefined, notice_period_days: candidateForm.notice_period_days ? Number(candidateForm.notice_period_days) : undefined, proposed_joining_date: candidateForm.proposed_joining_date || undefined, designation: candidateForm.designation || undefined, notes: candidateForm.notes || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setFeedback(editingCandidate ? 'Candidate updated' : 'Candidate created')
      setEditingCandidate(null)
      setCandidateForm(emptyCandidateForm)
    },
  })

  const offerMutation = useMutation({
    mutationFn: () => hiringApi.createOffer(Number(offerForm.candidate_id), { annual_ctc: offerForm.annual_ctc ? Number(offerForm.annual_ctc) : undefined, structure_id: offerForm.structure_id ? Number(offerForm.structure_id) : undefined, joining_date: offerForm.joining_date || undefined, reporting_manager: offerForm.reporting_manager || undefined, work_location: offerForm.work_location || undefined, probation_months: offerForm.probation_months ? Number(offerForm.probation_months) : undefined, additional_terms: offerForm.additional_terms || undefined, release_offer: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setFeedback('Offer released')
      setOfferForm(emptyOfferForm)
    },
  })

  const offerStatusMutation = useMutation({
    mutationFn: ({ offerId, status }: { offerId: number; status: 'accepted' | 'declined' | 'released' | 'draft' }) => hiringApi.updateOfferStatus(offerId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
    },
  })

  const onboardingMutation = useMutation({
    mutationFn: (offerId: number) => hiringApi.startOnboarding(offerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding-records'] })
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setFeedback('Onboarding started')
      setTab('onboarding')
    },
  })

  const cancelOnboardingMutation = useMutation({
    mutationFn: ({ onboardingId, declineOffer }: { onboardingId: number; declineOffer?: boolean }) => hiringApi.cancelOnboarding(onboardingId, declineOffer),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['onboarding-records'] })
      qc.invalidateQueries({ queryKey: ['offers'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      setFeedback(variables.declineOffer ? 'Onboarding cancelled and offer declined' : 'Onboarding cancelled')
      setSelectedOnboarding(null)
      setConvertForm(emptyConvertForm)
    },
  })

  const convertMutation = useMutation({
    mutationFn: () => hiringApi.convertToEmployee(selectedOnboarding!.id, convertForm),
    onSuccess: (employee) => {
      qc.invalidateQueries({ queryKey: ['onboarding-records'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['employees'] })
      setFeedback(`Employee created for ${employee.first_name} ${employee.last_name}`)
      setSelectedOnboarding(null)
      setConvertForm(emptyConvertForm)
      if (slug) navigate(`/${slug}/employees?tab=edit&employeeId=${employee.id}`)
    },
  })

  const metrics = useMemo(() => ({
    positions: positions.length,
    candidates: candidates.filter((candidate) => !['offer_declined', 'onboarding_cancelled', 'joined', 'rejected'].includes(candidate.stage)).length,
    offersReleased: offers.filter((offer) => offer.status === 'released').length,
    onboardingOpen: onboarding.filter((record) => record.status === 'in_progress' || record.status === 'pending').length,
    joined: candidates.filter((candidate) => candidate.stage === 'joined').length,
  }), [positions, candidates, offers, onboarding])

  const filteredPositions = useMemo(() => {
    return positions.filter((position) => {
      const searchNeedle = positionFilters.search.trim().toLowerCase()
      const searchMatch =
        !searchNeedle ||
        position.title.toLowerCase().includes(searchNeedle) ||
        positionCodeLabel(position).toLowerCase().includes(searchNeedle) ||
        (position.description || '').toLowerCase().includes(searchNeedle) ||
        (position.location || '').toLowerCase().includes(searchNeedle)
      const statusMatch = !positionFilters.status || position.status === positionFilters.status
      const departmentMatch = !positionFilters.department_id || String(position.department_id || '') === positionFilters.department_id
      const typeMatch = !positionFilters.employment_type || position.employment_type === positionFilters.employment_type
      const locationMatch = !positionFilters.location || (position.location || '') === positionFilters.location
      const vacancyMatch =
        !positionFilters.vacancy_state ||
        (positionFilters.vacancy_state === 'vacant' && position.open_vacancies > 0) ||
        (positionFilters.vacancy_state === 'filled' && position.open_vacancies === 0)
      const staffingMatch =
        !positionFilters.staffing_state ||
        (positionFilters.staffing_state === 'not_started' && position.filled_count === 0 && position.hiring_count === 0) ||
        (positionFilters.staffing_state === 'in_progress' && position.hiring_count > 0 && position.open_vacancies > 0) ||
        (positionFilters.staffing_state === 'partially_filled' && position.filled_count > 0 && position.open_vacancies > 0) ||
        (positionFilters.staffing_state === 'filled' && position.open_vacancies === 0)
      return searchMatch && statusMatch && departmentMatch && typeMatch && locationMatch && vacancyMatch && staffingMatch
    })
  }, [positionFilters, positions])

  const locationOptions = useMemo(
    () => Array.from(new Set(positions.map((position) => position.location).filter(Boolean) as string[])).sort(),
    [positions],
  )

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'positions', label: 'Open Positions' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'offers', label: 'Offers' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'position_form', label: editingPosition ? 'Edit Position' : 'Create Position' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader title="Hiring Workspace" subtitle="Run the full Position to Requisition to Candidate to Offer to Onboarding to Employee pipeline." />
      <div className="-mt-2 overflow-hidden rounded-t-2xl border border-[#29486d] bg-[#1e3a5f] shadow-sm">
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {tabs.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)} className={`border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${tab === item.key ? 'border-sky-300 bg-[#355783] text-white' : 'border-transparent text-blue-100 hover:bg-[#2b4a74] hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {feedback && <div className="border-x border-b border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{feedback}</div>}

      {tab === 'dashboard' && <SectionCard><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">{Object.entries(metrics).map(([key, value]) => <MetricCard key={key} label={key.replace(/([A-Z])/g, ' $1')} value={value} />)}</div></SectionCard>}

      {tab === 'positions' && (
        <SectionCard>
          <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Open Positions</p>
              <p className="mt-1 text-xs text-gray-500">Approved headcount and downstream requisition activity.</p>
            </div>
            <Button
              className="shrink-0 self-start"
              onClick={() => {
                setEditingPosition(null)
                setPositionForm(emptyPositionForm)
                setTab('position_form')
              }}
            >
              <Plus className="h-4 w-4" /> New Position
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.2fr_0.8fr]">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-4 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filters</p>
                <Button size="sm" variant="outline" onClick={() => setPositionFilters(emptyPositionFilters)}>Reset</Button>
              </div>
              <div className="space-y-4">
                <FormField label="Search">
                  <Input value={positionFilters.search} onChange={(e) => setPositionFilters((prev) => ({ ...prev, search: e.target.value }))} placeholder="ID, title, description..." />
                </FormField>
                <FormField label="Status">
                  <Select value={positionFilters.status} onChange={(e) => setPositionFilters((prev) => ({ ...prev, status: e.target.value }))}>
                    <option value="">All</option>
                    <option value="open">Open</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </Select>
                </FormField>
                <FormField label="Department">
                  <Select value={positionFilters.department_id} onChange={(e) => setPositionFilters((prev) => ({ ...prev, department_id: e.target.value }))}>
                    <option value="">All</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="Employment Type">
                  <Select value={positionFilters.employment_type} onChange={(e) => setPositionFilters((prev) => ({ ...prev, employment_type: e.target.value }))}>
                    <option value="">All</option>
                    <option value="permanent">Permanent</option>
                    <option value="contractor">Contractor</option>
                    <option value="trainee">Trainee</option>
                    <option value="intern">Intern</option>
                  </Select>
                </FormField>
                <FormField label="Location">
                  <Select value={positionFilters.location} onChange={(e) => setPositionFilters((prev) => ({ ...prev, location: e.target.value }))}>
                    <option value="">All</option>
                    {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                  </Select>
                </FormField>
                <FormField label="Vacancy State">
                  <Select value={positionFilters.vacancy_state} onChange={(e) => setPositionFilters((prev) => ({ ...prev, vacancy_state: e.target.value }))}>
                    <option value="">All</option>
                    <option value="vacant">Has Vacancies</option>
                    <option value="filled">No Vacancies</option>
                  </Select>
                </FormField>
                <FormField label="Staffing State">
                  <Select value={positionFilters.staffing_state} onChange={(e) => setPositionFilters((prev) => ({ ...prev, staffing_state: e.target.value }))}>
                    <option value="">All</option>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">Hiring In Progress</option>
                    <option value="partially_filled">Partially Filled</option>
                    <option value="filled">Fully Filled</option>
                  </Select>
                </FormField>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-gray-700">{filteredPositions.length} positions found</p>
                <p className="text-xs text-gray-500">Showing roles that match the selected filters</p>
              </div>
              <div className="space-y-3">
                {filteredPositions.map((position) => (
                  <ListRow key={position.id} title={position.title} subtitle={`${positionCodeLabel(position)} | ${position.department?.name || 'No department'} | ${position.location || 'Location not set'}`}>
                    <Badge variant={badge(position.status)}>{position.status}</Badge>
                    <span className="text-xs text-gray-500">{position.open_vacancies} vacancies</span>
                    <Button size="sm" variant="outline" onClick={() => { setCandidateForm({ ...emptyCandidateForm, position_id: String(position.id), designation: position.title }); setEditingCandidate(null); setTab('candidates') }}>Add Candidate</Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingPosition(position); setPositionForm({ title: position.title, department_id: position.department_id ? String(position.department_id) : '', employment_type: position.employment_type || 'permanent', location: position.location || '', openings: String(position.openings || 1), status: position.status || 'open', description: position.description || '' }); setTab('position_form') }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    <Button size="sm" variant="outline" onClick={() => deletePositionMutation.mutate(position.id)} loading={deletePositionMutation.isPending}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  </ListRow>
                ))}
                {filteredPositions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                    No positions match the selected filters.
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {tab === 'candidates' && (
        <SectionCard title="Candidates" subtitle="Applicants mapped directly to positions and ready for offer evaluation.">
          <GridForm>
            <FormField label="Position"><Select value={candidateForm.position_id} onChange={(e) => setCandidateForm((p) => ({ ...p, position_id: e.target.value }))}><option value="">Select</option>{positions.map((position) => <option key={position.id} value={position.id}>{positionCodeLabel(position)} - {position.title}</option>)}</Select></FormField>
            <FormField label="First Name"><Input value={candidateForm.first_name} onChange={(e) => setCandidateForm((p) => ({ ...p, first_name: e.target.value }))} /></FormField>
            <FormField label="Last Name"><Input value={candidateForm.last_name} onChange={(e) => setCandidateForm((p) => ({ ...p, last_name: e.target.value }))} /></FormField>
            <FormField label="Email"><Input type="email" value={candidateForm.email} onChange={(e) => setCandidateForm((p) => ({ ...p, email: e.target.value }))} /></FormField>
            <FormField label="Phone"><Input value={candidateForm.phone} onChange={(e) => setCandidateForm((p) => ({ ...p, phone: e.target.value }))} /></FormField>
            <FormField label="Stage"><Select value={candidateForm.stage} onChange={(e) => setCandidateForm((p) => ({ ...p, stage: e.target.value }))}><option value="applied">Applied</option><option value="screening">Screening</option><option value="interview">Interview</option><option value="rejected">Rejected</option></Select></FormField>
          </GridForm>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => candidateMutation.mutate()} loading={candidateMutation.isPending} disabled={!candidateForm.position_id || !candidateForm.first_name || !candidateForm.last_name || !candidateForm.email}>Save Candidate</Button>
            <Button variant="outline" onClick={() => { setEditingCandidate(null); setCandidateForm(emptyCandidateForm) }}>Reset</Button>
          </div>
          <div className="mt-4 space-y-3">
            {candidates.map((candidate) => (
              <ListRow key={candidate.id} title={`${candidate.first_name} ${candidate.last_name}`} subtitle={`${positionCodeLabel(candidate.position || candidate.requisition?.position)} | ${candidate.position?.title || candidate.requisition?.position?.title || 'No position'} | ${candidate.position?.department?.name || candidate.requisition?.position?.department?.name || 'No department'}`}>
                <Badge variant={badge(candidate.stage)}>{candidate.stage}</Badge>
                <span className="text-xs text-gray-500">{candidate.expected_ctc ? formatCurrency(candidate.expected_ctc) : 'No expected CTC'}</span>
                {candidate.stage !== 'offer_declined' && candidate.stage !== 'onboarding_cancelled' && candidate.stage !== 'joined' && candidate.stage !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => { setEditingCandidate(candidate); setCandidateForm({ position_id: String(candidate.position_id || candidate.requisition?.position_id || ''), first_name: candidate.first_name, last_name: candidate.last_name, email: candidate.email, phone: candidate.phone || '', source: candidate.source || '', stage: candidate.stage, current_ctc: candidate.current_ctc ? String(candidate.current_ctc) : '', expected_ctc: candidate.expected_ctc ? String(candidate.expected_ctc) : '', notice_period_days: candidate.notice_period_days ? String(candidate.notice_period_days) : '', proposed_joining_date: candidate.proposed_joining_date || '', designation: candidate.designation || '', notes: candidate.notes || '' }) }}>Edit</Button>
                )}
                {candidate.stage !== 'offer_declined' && candidate.stage !== 'onboarding_cancelled' && candidate.stage !== 'joined' && candidate.stage !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => { setOfferForm({ ...emptyOfferForm, candidate_id: String(candidate.id), annual_ctc: candidate.expected_ctc ? String(candidate.expected_ctc) : '', joining_date: candidate.proposed_joining_date || '' }); setTab('offers') }}>Create Offer</Button>
                )}
              </ListRow>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === 'offers' && (
        <SectionCard title="Offers" subtitle="Generate letters, release offers, and move accepted candidates into onboarding.">
          <GridForm>
            <FormField label="Candidate"><Select value={offerForm.candidate_id} onChange={(e) => setOfferForm((p) => ({ ...p, candidate_id: e.target.value }))}><option value="">Select</option>{candidates.filter((candidate) => !['joined', 'rejected'].includes(candidate.stage)).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.first_name} {candidate.last_name}</option>)}</Select></FormField>
            <FormField label="Annual CTC"><Input type="number" value={offerForm.annual_ctc} onChange={(e) => setOfferForm((p) => ({ ...p, annual_ctc: e.target.value }))} /></FormField>
            <FormField label="Salary Structure"><Select value={offerForm.structure_id} onChange={(e) => setOfferForm((p) => ({ ...p, structure_id: e.target.value }))}><option value="">Select</option>{structures.filter((structure) => structure.is_active).map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}</Select></FormField>
            <FormField label="Joining Date"><Input type="date" value={offerForm.joining_date} onChange={(e) => setOfferForm((p) => ({ ...p, joining_date: e.target.value }))} /></FormField>
            <FormField label="Reporting Manager"><Input value={offerForm.reporting_manager} onChange={(e) => setOfferForm((p) => ({ ...p, reporting_manager: e.target.value }))} /></FormField>
            <FormField label="Work Location"><Input value={offerForm.work_location} onChange={(e) => setOfferForm((p) => ({ ...p, work_location: e.target.value }))} /></FormField>
          </GridForm>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" disabled={!offerForm.candidate_id} onClick={async () => {
              const blob = await hiringApi.previewOffer(Number(offerForm.candidate_id), { annual_ctc: offerForm.annual_ctc ? Number(offerForm.annual_ctc) : undefined, structure_id: offerForm.structure_id ? Number(offerForm.structure_id) : undefined, joining_date: offerForm.joining_date || undefined, reporting_manager: offerForm.reporting_manager || undefined, work_location: offerForm.work_location || undefined, probation_months: offerForm.probation_months ? Number(offerForm.probation_months) : undefined, additional_terms: offerForm.additional_terms || undefined, release_offer: false })
              const url = URL.createObjectURL(blob)
              window.open(url, '_blank', 'noopener,noreferrer')
              setTimeout(() => URL.revokeObjectURL(url), 60000)
            }}><Eye className="h-4 w-4" /> Preview Offer</Button>
            <Button onClick={() => offerMutation.mutate()} loading={offerMutation.isPending} disabled={!offerForm.candidate_id}>Release Offer</Button>
          </div>
          <div className="mt-4 space-y-3">
            {offers.map((offer) => (
              <ListRow key={offer.id} title={`${offer.candidate?.first_name} ${offer.candidate?.last_name}`} subtitle={`${positionCodeLabel(offer.candidate?.position || offer.candidate?.requisition?.position)} | ${offer.candidate?.position?.title || offer.candidate?.requisition?.position?.title || 'No position'} | ${offer.candidate?.position?.department?.name || offer.candidate?.requisition?.position?.department?.name || 'No department'}`}>
                <Badge variant={badge(offer.status)}>{offer.status}</Badge>
                <span className="text-xs text-gray-500">{offer.annual_ctc ? formatCurrency(offer.annual_ctc) : 'No CTC'}</span>
                <Button size="sm" variant="outline" onClick={async () => downloadBlob(await hiringApi.downloadOfferDocument(offer.id), offer.document_file_name || 'offer_letter.pdf')}><FileDown className="h-3.5 w-3.5" /> Download</Button>
                {offer.status !== 'accepted' && offer.status !== 'declined' && <Button size="sm" variant="outline" onClick={() => offerStatusMutation.mutate({ offerId: offer.id, status: 'accepted' })}>Accept</Button>}
                {offer.status !== 'declined' && offer.status !== 'accepted' && <Button size="sm" variant="outline" onClick={() => offerStatusMutation.mutate({ offerId: offer.id, status: 'declined' })}>Decline</Button>}
                {offer.status === 'accepted' && <Button size="sm" variant="outline" onClick={() => onboardingMutation.mutate(offer.id)}>Start Onboarding</Button>}
              </ListRow>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === 'onboarding' && (
        <SectionCard title="Onboarding" subtitle="Collect pre-join details and convert completed onboarding into an employee record.">
          <div className="space-y-3">
            {onboarding.map((record) => (
              <ListRow key={record.id} title={`${record.candidate?.first_name} ${record.candidate?.last_name}`} subtitle={`${positionCodeLabel(record.candidate?.position || record.offer?.candidate?.requisition?.position)} | ${record.candidate?.position?.title || record.offer?.candidate?.requisition?.position?.title || ''} | ${record.status}`}>
                <Badge variant={badge(record.status)}>{record.status}</Badge>
                <span className="text-xs text-gray-500">{record.started_on ? formatDate(record.started_on) : 'Not started'}</span>
                {record.employee_id ? (
                  <Button size="sm" variant="outline" onClick={() => slug && navigate(`/${slug}/employees?tab=edit&employeeId=${record.employee_id}`)}>Open Employee</Button>
                ) : (
                  <>
                    {record.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => cancelOnboardingMutation.mutate({ onboardingId: record.id })} loading={cancelOnboardingMutation.isPending}>
                        Cancel Onboarding
                      </Button>
                    )}
                    {record.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => cancelOnboardingMutation.mutate({ onboardingId: record.id, declineOffer: true })} loading={cancelOnboardingMutation.isPending}>
                        Cancel + Decline Offer
                      </Button>
                    )}
                    {record.status !== 'cancelled' && (
                      <Button size="sm" variant="outline" onClick={() => { setSelectedOnboarding(record); setConvertForm({ ...emptyConvertForm, emp_code: `E${String(Date.now()).slice(-5)}` }) }}><UserCheck className="h-3.5 w-3.5" /> Convert</Button>
                    )}
                  </>
                )}
              </ListRow>
            ))}
          </div>
        </SectionCard>
      )}

      {tab === 'position_form' && (
        <SectionCard title={editingPosition ? 'Edit Position' : 'Create Position'} subtitle="Define the headcount slot before raising requisitions.">
          <GridForm>
            <FormField label="Position ID"><Input value={editingPosition ? positionCodeLabel(editingPosition) : 'Generated after first save'} readOnly className="bg-gray-50 text-gray-500" /></FormField>
            <FormField label="Title"><Input value={positionForm.title} onChange={(e) => setPositionForm((p) => ({ ...p, title: e.target.value }))} /></FormField>
            <FormField label="Department"><Select value={positionForm.department_id} onChange={(e) => setPositionForm((p) => ({ ...p, department_id: e.target.value }))}><option value="">Select</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select></FormField>
            <FormField label="Employment Type"><Select value={positionForm.employment_type} onChange={(e) => setPositionForm((p) => ({ ...p, employment_type: e.target.value }))}><option value="permanent">Permanent</option><option value="contractor">Contractor</option><option value="trainee">Trainee</option><option value="intern">Intern</option></Select></FormField>
            <FormField label="Location"><Input value={positionForm.location} onChange={(e) => setPositionForm((p) => ({ ...p, location: e.target.value }))} /></FormField>
            <FormField label="Openings"><Input type="number" value={positionForm.openings} onChange={(e) => setPositionForm((p) => ({ ...p, openings: e.target.value }))} /></FormField>
            <FormField label="Status"><Select value={positionForm.status} onChange={(e) => setPositionForm((p) => ({ ...p, status: e.target.value }))}><option value="open">Open</option><option value="on_hold">On Hold</option><option value="closed">Closed</option></Select></FormField>
          </GridForm>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => positionMutation.mutate()} loading={positionMutation.isPending} disabled={!positionForm.title}>Save Position</Button>
            <Button variant="outline" onClick={() => { setEditingPosition(null); setPositionForm(emptyPositionForm) }}>Reset</Button>
          </div>
        </SectionCard>
      )}

      {selectedOnboarding && <ConvertModal record={selectedOnboarding} values={convertForm} onClose={() => { setSelectedOnboarding(null); setConvertForm(emptyConvertForm) }} onChange={(field, value) => setConvertForm((prev) => ({ ...prev, [field]: value }))} onSubmit={() => convertMutation.mutate()} loading={convertMutation.isPending} />}
    </div>
  )
}

function SectionCard({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return <Card className="rounded-t-none border-gray-200 shadow-sm"><CardContent className="space-y-4 p-5">{title && <div><p className="text-sm font-semibold text-gray-800">{title}</p>{subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}</div>}{children}</CardContent></Card>
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <Card className="border-gray-200 bg-gray-50"><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p></CardContent></Card>
}

function ListRow({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4"><div><p className="text-sm font-semibold text-gray-900">{title}</p><p className="mt-1 text-xs text-gray-500">{subtitle}</p></div><div className="flex flex-wrap items-center gap-2">{children}</div></div>
}

function GridForm({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>
}

function ConvertModal({ record, values, onClose, onChange, onSubmit, loading }: { record: OnboardingRecord; values: typeof emptyConvertForm; onClose: () => void; onChange: (field: keyof typeof emptyConvertForm, value: string) => void; onSubmit: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div><p className="text-sm font-semibold text-gray-900">Convert To Employee</p><p className="mt-1 text-xs text-gray-500">{record.candidate?.first_name} {record.candidate?.last_name} will be created as an active employee.</p></div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-3">
          <FormField label="Employee Code"><Input value={values.emp_code} onChange={(e) => onChange('emp_code', e.target.value)} /></FormField>
          <FormField label="Phone"><Input value={values.phone} onChange={(e) => onChange('phone', e.target.value)} /></FormField>
          <FormField label="Date of Birth"><Input type="date" value={values.date_of_birth} onChange={(e) => onChange('date_of_birth', e.target.value)} /></FormField>
          <FormField label="PAN"><Input value={values.pan} onChange={(e) => onChange('pan', e.target.value)} /></FormField>
          <FormField label="Aadhaar"><Input value={values.aadhaar} onChange={(e) => onChange('aadhaar', e.target.value)} /></FormField>
          <FormField label="UAN"><Input value={values.uan} onChange={(e) => onChange('uan', e.target.value)} /></FormField>
          <FormField label="Bank Account"><Input value={values.bank_account} onChange={(e) => onChange('bank_account', e.target.value)} /></FormField>
          <FormField label="IFSC"><Input value={values.ifsc_code} onChange={(e) => onChange('ifsc_code', e.target.value)} /></FormField>
          <FormField label="Bank Name"><Input value={values.bank_name} onChange={(e) => onChange('bank_name', e.target.value)} /></FormField>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit} loading={loading} disabled={!values.emp_code}><UserCheck className="h-4 w-4" /> Create Employee</Button>
        </div>
      </div>
    </div>
  )
}
