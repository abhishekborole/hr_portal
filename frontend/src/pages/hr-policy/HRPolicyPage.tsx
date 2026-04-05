import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Landmark, ShieldCheck, Plus, Trash2 } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { attendanceApi, hrPolicyApi } from '@/lib/api'
import type { Holiday, HRPolicy } from '@/types'

const emptyPolicy: HRPolicy = {
  id: 0,
  tenant_id: 0,
  casual_leave_days: 12,
  sick_leave_days: 12,
  earned_leave_days: 15,
  comp_off_enabled: false,
  maternity_leave_days: 182,
  paternity_leave_days: 7,
  leave_accrual_mode: 'monthly',
  carry_forward_max_days: 10,
  leave_encashment_enabled: false,
  half_day_leave_allowed: true,
  sandwich_leave_enabled: false,
  weekend_days: 'saturday,sunday',
  weekly_working_days: 5,
  holiday_calendar_name: '',
  payroll_cutoff_day: 25,
  payroll_payout_day: 30,
  lop_enabled: true,
  late_grace_minutes: 15,
  half_day_threshold_minutes: 240,
  probation_months: 6,
  notice_period_days: 30,
  onboarding_checklist: 'Offer letter\nKYC documents\nBank details\nPolicy acceptance',
  exit_notice_recovery_enabled: true,
  leave_encashment_on_exit: true,
  fnf_settlement_days: 45,
  created_at: '',
  updated_at: '',
}

type TabKey = 'leave' | 'payroll' | 'employment'

export default function HRPolicyPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('leave')
  const [form, setForm] = useState<HRPolicy>(emptyPolicy)
  const [message, setMessage] = useState('')
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [holidayForm, setHolidayForm] = useState({ name: '', date: '', holiday_type: 'national' })

  const { data: policy } = useQuery({
    queryKey: ['hr-policy'],
    queryFn: hrPolicyApi.get,
  })
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', holidayYear],
    queryFn: () => attendanceApi.holidays(holidayYear),
  })

  useEffect(() => {
    if (policy) setForm(policy)
  }, [policy])

  const saveMutation = useMutation({
    mutationFn: () => hrPolicyApi.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-policy'] })
      setMessage('HR policy updated')
    },
  })
  const createHolidayMutation = useMutation({
    mutationFn: () => attendanceApi.createHoliday(holidayForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] })
      setHolidayForm({ name: '', date: '', holiday_type: 'national' })
      setMessage('Holiday added')
    },
  })
  const deleteHolidayMutation = useMutation({
    mutationFn: (id: number) => attendanceApi.deleteHoliday(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['holidays'] })
      setMessage('Holiday deleted')
    },
  })

  function setField<K extends keyof HRPolicy>(field: K, value: HRPolicy[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'leave', label: 'Leave & Attendance' },
    { key: 'payroll', label: 'Payroll & Workweek' },
    { key: 'employment', label: 'Employment Rules' },
  ]

  return (
    <div className="space-y-0">
      <PageHeader
        title="HR Policy"
        subtitle="Maintain company-wide leave, payroll, workweek, onboarding, and exit policy settings."
        action={
          <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
            Save Policy
          </Button>
        }
      />

      <div className="-mt-2 overflow-hidden rounded-t-2xl border border-[#29486d] bg-[#1e3a5f] shadow-sm">
        <div className="flex flex-wrap gap-1 px-3 pt-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`border-b-2 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${
                tab === item.key ? 'border-sky-300 bg-[#355783] text-white' : 'border-transparent text-blue-100 hover:bg-[#2b4a74] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {message && <div className="border-x border-b border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {tab === 'leave' && (
        <div className="space-y-5">
          <PolicySection icon={CalendarClock} title="Leave Entitlements" subtitle="Define leave availability, accrual, and carry-forward settings for the company.">
            <GridForm>
              <FormField label="Casual Leave / Year"><Input type="number" value={form.casual_leave_days} onChange={(e) => setField('casual_leave_days', Number(e.target.value))} /></FormField>
              <FormField label="Sick Leave / Year"><Input type="number" value={form.sick_leave_days} onChange={(e) => setField('sick_leave_days', Number(e.target.value))} /></FormField>
              <FormField label="Earned Leave / Year"><Input type="number" value={form.earned_leave_days} onChange={(e) => setField('earned_leave_days', Number(e.target.value))} /></FormField>
              <FormField label="Maternity Leave / Days"><Input type="number" value={form.maternity_leave_days} onChange={(e) => setField('maternity_leave_days', Number(e.target.value))} /></FormField>
              <FormField label="Paternity Leave / Days"><Input type="number" value={form.paternity_leave_days} onChange={(e) => setField('paternity_leave_days', Number(e.target.value))} /></FormField>
              <FormField label="Accrual Mode">
                <Select value={form.leave_accrual_mode} onChange={(e) => setField('leave_accrual_mode', e.target.value as HRPolicy['leave_accrual_mode'])}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Select>
              </FormField>
              <FormField label="Carry Forward Max Days"><Input type="number" value={form.carry_forward_max_days} onChange={(e) => setField('carry_forward_max_days', Number(e.target.value))} /></FormField>
            </GridForm>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ToggleCard title="Comp Off Enabled" value={form.comp_off_enabled} onToggle={(checked) => setField('comp_off_enabled', checked)} />
              <ToggleCard title="Leave Encashment" value={form.leave_encashment_enabled} onToggle={(checked) => setField('leave_encashment_enabled', checked)} />
              <ToggleCard title="Half-Day Leave" value={form.half_day_leave_allowed} onToggle={(checked) => setField('half_day_leave_allowed', checked)} />
              <ToggleCard title="Sandwich Leave" value={form.sandwich_leave_enabled} onToggle={(checked) => setField('sandwich_leave_enabled', checked)} />
            </div>
          </PolicySection>

          <PolicySection icon={CalendarClock} title="Holiday Calendar" subtitle="Create and maintain the annual holiday list used for leave and attendance policies.">
            <div className="grid gap-5 xl:grid-cols-[0.42fr_0.58fr]">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">Add Holiday</p>
                  <Input className="w-28" type="number" value={holidayYear} onChange={(e) => setHolidayYear(Number(e.target.value))} />
                </div>
                <div className="space-y-4">
                  <FormField label="Holiday Name">
                    <Input value={holidayForm.name} onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Republic Day" />
                  </FormField>
                  <FormField label="Date">
                    <Input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))} />
                  </FormField>
                  <FormField label="Type">
                    <Select value={holidayForm.holiday_type} onChange={(e) => setHolidayForm((prev) => ({ ...prev, holiday_type: e.target.value }))}>
                      <option value="national">National</option>
                      <option value="festival">Festival</option>
                      <option value="company">Company</option>
                    </Select>
                  </FormField>
                  <Button
                    onClick={() => createHolidayMutation.mutate()}
                    loading={createHolidayMutation.isPending}
                    disabled={!holidayForm.name || !holidayForm.date}
                  >
                    <Plus className="h-4 w-4" /> Add Holiday
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Holiday List</p>
                    <p className="text-xs text-gray-500">Configured holidays for {holidayYear}</p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {holidays.length} holidays
                  </div>
                </div>

                {holidays.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                    No holidays configured for {holidayYear}
                  </div>
                ) : (
                  holidays.map((holiday) => (
                    <HolidayRow
                      key={holiday.id}
                      holiday={holiday}
                      onDelete={() => deleteHolidayMutation.mutate(holiday.id)}
                      deleting={deleteHolidayMutation.isPending}
                    />
                  ))
                )}
              </div>
            </div>
          </PolicySection>
        </div>
      )}

      {tab === 'payroll' && (
        <div className="space-y-5">
          <PolicySection icon={Landmark} title="Payroll & Workweek" subtitle="Set workweek rules, attendance thresholds, and payroll operational settings.">
            <GridForm>
              <FormField label="Weekly Working Days"><Input type="number" value={form.weekly_working_days} onChange={(e) => setField('weekly_working_days', Number(e.target.value))} /></FormField>
              <FormField label="Weekend Days">
                <Select value={form.weekend_days} onChange={(e) => setField('weekend_days', e.target.value)}>
                  <option value="saturday,sunday">Saturday, Sunday</option>
                  <option value="sunday">Sunday Only</option>
                  <option value="friday,saturday">Friday, Saturday</option>
                </Select>
              </FormField>
              <FormField label="Holiday Calendar Name"><Input value={form.holiday_calendar_name || ''} onChange={(e) => setField('holiday_calendar_name', e.target.value)} placeholder="India General Holiday Calendar" /></FormField>
              <FormField label="Payroll Cut-off Day"><Input type="number" value={form.payroll_cutoff_day} onChange={(e) => setField('payroll_cutoff_day', Number(e.target.value))} /></FormField>
              <FormField label="Payroll Payout Day"><Input type="number" value={form.payroll_payout_day} onChange={(e) => setField('payroll_payout_day', Number(e.target.value))} /></FormField>
              <FormField label="Late Grace Minutes"><Input type="number" value={form.late_grace_minutes} onChange={(e) => setField('late_grace_minutes', Number(e.target.value))} /></FormField>
              <FormField label="Half-Day Threshold Minutes"><Input type="number" value={form.half_day_threshold_minutes} onChange={(e) => setField('half_day_threshold_minutes', Number(e.target.value))} /></FormField>
            </GridForm>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ToggleCard title="Loss Of Pay Enabled" value={form.lop_enabled} onToggle={(checked) => setField('lop_enabled', checked)} />
            </div>
          </PolicySection>
        </div>
      )}

      {tab === 'employment' && (
        <div className="space-y-5">
          <PolicySection icon={ShieldCheck} title="Employment Rules" subtitle="Manage probation, notice period, onboarding checklist, and exit settlement standards.">
            <GridForm>
              <FormField label="Probation Months"><Input type="number" value={form.probation_months} onChange={(e) => setField('probation_months', Number(e.target.value))} /></FormField>
              <FormField label="Notice Period Days"><Input type="number" value={form.notice_period_days} onChange={(e) => setField('notice_period_days', Number(e.target.value))} /></FormField>
              <FormField label="F&F Settlement Days"><Input type="number" value={form.fnf_settlement_days} onChange={(e) => setField('fnf_settlement_days', Number(e.target.value))} /></FormField>
            </GridForm>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <ToggleCard title="Exit Notice Recovery" value={form.exit_notice_recovery_enabled} onToggle={(checked) => setField('exit_notice_recovery_enabled', checked)} />
              <ToggleCard title="Leave Encashment On Exit" value={form.leave_encashment_on_exit} onToggle={(checked) => setField('leave_encashment_on_exit', checked)} />
            </div>
            <FormField label="Onboarding Checklist">
              <Textarea
                value={form.onboarding_checklist || ''}
                onChange={(e) => setField('onboarding_checklist', e.target.value)}
                placeholder="Offer letter&#10;KYC documents&#10;Bank details&#10;Policy acceptance"
                className="min-h-[160px]"
              />
            </FormField>
          </PolicySection>
        </div>
      )}
    </div>
  )
}

function HolidayRow({ holiday, onDelete, deleting }: { holiday: Holiday; onDelete: () => void; deleting: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{holiday.name}</p>
        <p className="mt-1 text-xs text-gray-500">
          {new Date(holiday.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {holiday.holiday_type}
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={onDelete} loading={deleting}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  )
}

function PolicySection({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card className="rounded-t-none border-gray-200 shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function GridForm({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function ToggleCard({ title, value, onToggle }: { title: string; value: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800">{title}</p>
          <p className="text-xs text-gray-500">{value ? 'Enabled' : 'Disabled'}</p>
        </div>
        <button
          type="button"
          onClick={() => onToggle(!value)}
          aria-pressed={value}
          className={`relative inline-flex h-7 w-12 items-center rounded-full px-0.5 transition-colors ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
        >
          <span className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  )
}
