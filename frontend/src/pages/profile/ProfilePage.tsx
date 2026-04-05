import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { profileApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, CreditCard, MapPin, Pencil, BadgeCheck, Building2, CalendarDays } from 'lucide-react'

type ProfileUpdate = {
  phone?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  ifsc_code?: string
  bank_name?: string
  bank_account?: string
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="mt-1 block break-words text-sm font-medium text-gray-800">{value ?? '-'}</span>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
        <Icon className="h-3.5 w-3.5 text-blue-600" />
      </div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
    </div>
  )
}

function ProfileStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-blue-100">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-sm font-medium text-white break-words">{value}</p>
    </div>
  )
}

export default function ProfilePage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const { data: emp, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: profileApi.get,
  })

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ProfileUpdate>()

  const updateMutation = useMutation({
    mutationFn: (data: ProfileUpdate) => profileApi.update(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-profile'] })
      setEditing(false)
      setSaveMsg('Profile updated successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    },
  })

  function startEdit() {
    if (!emp) return
    reset({
      phone: emp.phone ?? '',
      address: emp.address ?? '',
      city: emp.city ?? '',
      state: emp.state ?? '',
      pincode: emp.pincode ?? '',
      ifsc_code: emp.ifsc_code ?? '',
      bank_name: emp.bank_name ?? '',
      bank_account: '',
    })
    setEditing(true)
  }

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Loading profile...</div>
  if (!emp) return <div className="p-8 text-sm text-red-500">No employee profile linked to your account.</div>

  const lifecycleLabel = emp.lifecycle_stage
    ? emp.lifecycle_stage.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Active'
  const employmentTypeLabel = emp.employment_type
    ? emp.employment_type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : '-'

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={`${emp.emp_code} · ${emp.designation ?? 'Employee'}`}
        action={
          !editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit Contact & Bank
            </Button>
          ) : undefined
        }
      />

      {saveMsg && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.7fr_0.9fr]">
        <div className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <SectionHeader icon={User} title="Personal Information" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <InfoRow label="First Name" value={emp.first_name} />
                <InfoRow label="Last Name" value={emp.last_name} />
                <InfoRow label="Email" value={emp.email} />
                <InfoRow label="Gender" value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                <InfoRow label="Date of Birth" value={emp.date_of_birth} />
                <InfoRow label="Date of Joining" value={emp.date_of_joining} />
                <InfoRow label="Department" value={emp.department?.name} />
                <InfoRow label="Designation" value={emp.designation} />
                <InfoRow label="Employment Type" value={employmentTypeLabel} />
                <InfoRow label="UAN" value={emp.uan} />
              </div>
            </CardContent>
          </Card>

          {editing ? (
            <Card>
              <CardContent className="p-6">
                <SectionHeader icon={MapPin} title="Edit Contact & Bank Details" />
                <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))} className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="col-span-2 space-y-1.5">
                      <Label>Phone</Label>
                      <Input placeholder="Mobile number" {...register('phone')} />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Address</Label>
                      <Input placeholder="Street address" {...register('address')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Input placeholder="City" {...register('city')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>State</Label>
                      <Input placeholder="State" {...register('state')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pincode</Label>
                      <Input placeholder="Pincode" {...register('pincode')} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Bank Details</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Bank Name</Label>
                        <Input placeholder="HDFC Bank" {...register('bank_name')} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>IFSC Code</Label>
                        <Input placeholder="HDFC0001234" {...register('ifsc_code')} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label>Account Number</Label>
                        <Input type="password" placeholder="Leave blank to keep unchanged" {...register('bank_account')} />
                        <p className="text-xs text-gray-400">Leave blank if you don't want to change.</p>
                      </div>
                    </div>
                  </div>

                  {updateMutation.error && (
                    <p className="text-xs text-red-500">Update failed. Please try again.</p>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" loading={isSubmitting || updateMutation.isPending}>Save Changes</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <SectionHeader icon={MapPin} title="Contact & Address" />
                  <div className="grid grid-cols-1 gap-3">
                    <InfoRow label="Phone" value={emp.phone} />
                    <InfoRow label="Address" value={emp.address} />
                    <InfoRow label="City" value={emp.city} />
                    <InfoRow label="State" value={emp.state} />
                    <InfoRow label="Pincode" value={emp.pincode} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <SectionHeader icon={CreditCard} title="Bank & Identity" />
                  <div className="grid grid-cols-1 gap-3">
                    <InfoRow label="Bank Name" value={emp.bank_name} />
                    <InfoRow label="IFSC Code" value={emp.ifsc_code} />
                    <InfoRow label="Account Number" value={emp.bank_account} />
                    <InfoRow label="PAN" value={emp.pan} />
                    <InfoRow label="Aadhaar" value={emp.aadhaar} />
                    <InfoRow label="UAN" value={emp.uan} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardContent className="p-6">
              <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] via-[#29486d] to-[#3d638f] p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{emp.first_name} {emp.last_name}</p>
                    <p className="mt-1 text-sm text-blue-100">{emp.designation ?? 'Employee'}</p>
                  </div>
                  <div className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-50">
                    {lifecycleLabel}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <ProfileStat icon={BadgeCheck} label="Employee Code" value={emp.emp_code} />
                  <ProfileStat icon={Building2} label="Department" value={emp.department?.name || 'Not assigned'} />
                  <ProfileStat icon={CalendarDays} label="Joined On" value={emp.date_of_joining || 'Not set'} />
                  <ProfileStat icon={User} label="Employment Type" value={employmentTypeLabel} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <SectionHeader icon={User} title="Leave Balances" />
              <div className="space-y-4">
                {[
                  { label: 'Casual Leave (CL)', balance: emp.cl_balance, total: 12, color: 'bg-blue-500' },
                  { label: 'Sick Leave (SL)', balance: emp.sl_balance, total: 12, color: 'bg-purple-500' },
                  { label: 'Earned Leave (EL)', balance: emp.el_balance, total: 15, color: 'bg-green-500' },
                ].map(({ label, balance, total, color }) => (
                  <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <div className="mb-2 flex justify-between">
                      <span className="text-xs text-gray-600">{label}</span>
                      <span className="text-xs font-semibold text-gray-800">{balance} / {total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`${color} h-full rounded-full`}
                        style={{ width: `${(balance / total) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
