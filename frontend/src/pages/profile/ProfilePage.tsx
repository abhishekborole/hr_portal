import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { profileApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { User, Building2, CreditCard, MapPin, Pencil } from 'lucide-react'

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
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-blue-600" />
      </div>
      <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
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

  const gross = (Number(emp.basic_salary) || 0) + (Number(emp.hra) || 0) +
    (Number(emp.special_allowance) || 0) + (Number(emp.conveyance_allowance) || 0) +
    (Number(emp.medical_allowance) || 0)

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle={`${emp.emp_code} · ${emp.designation ?? 'Employee'}`}
        action={
          !editing ? (
            <Button size="sm" variant="outline" onClick={startEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit Contact & Bank
            </Button>
          ) : undefined
        }
      />

      {saveMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Personal Info */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardContent className="p-5">
              <SectionHeader icon={User} title="Personal Information" />
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="First Name" value={emp.first_name} />
                <InfoRow label="Last Name" value={emp.last_name} />
                <InfoRow label="Email" value={emp.email} />
                <InfoRow label="Gender" value={emp.gender ? emp.gender.charAt(0).toUpperCase() + emp.gender.slice(1) : undefined} />
                <InfoRow label="Date of Birth" value={emp.date_of_birth} />
                <InfoRow label="Date of Joining" value={emp.date_of_joining} />
                <InfoRow label="Department" value={emp.department?.name} />
                <InfoRow label="Designation" value={emp.designation} />
                <InfoRow label="Employment Type" value={emp.employment_type?.replace('_', ' ')} />
                <InfoRow label="UAN" value={emp.uan} />
              </div>
            </CardContent>
          </Card>

          {editing ? (
            <Card>
              <CardContent className="p-5">
                <SectionHeader icon={MapPin} title="Edit Contact & Bank Details" />
                <form onSubmit={handleSubmit((v) => updateMutation.mutate(v))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
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
                  <hr className="border-gray-100" />
                  <p className="text-xs text-gray-500">Bank Details</p>
                  <div className="grid grid-cols-2 gap-3">
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
            <Card>
              <CardContent className="p-5">
                <SectionHeader icon={MapPin} title="Contact & Address" />
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Phone" value={emp.phone} />
                  <InfoRow label="Address" value={emp.address} />
                  <InfoRow label="City" value={emp.city} />
                  <InfoRow label="State" value={emp.state} />
                  <InfoRow label="Pincode" value={emp.pincode} />
                </div>
              </CardContent>
            </Card>
          )}

          {!editing && (
            <Card>
              <CardContent className="p-5">
                <SectionHeader icon={CreditCard} title="Bank Details" />
                <div className="grid grid-cols-2 gap-4">
                  <InfoRow label="Bank Name" value={emp.bank_name} />
                  <InfoRow label="IFSC Code" value={emp.ifsc_code} />
                  <InfoRow label="Account Number" value={emp.bank_account} />
                  <InfoRow label="PAN" value={emp.pan} />
                  <InfoRow label="Aadhaar" value={emp.aadhaar} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar: salary + leaves */}
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <SectionHeader icon={Building2} title="Salary Structure" />
              <div className="space-y-2">
                {[
                  { label: 'Basic', value: emp.basic_salary },
                  { label: 'HRA', value: emp.hra },
                  { label: 'Special Allowance', value: emp.special_allowance },
                  { label: 'Conveyance', value: emp.conveyance_allowance },
                  { label: 'Medical', value: emp.medical_allowance },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-medium text-gray-800">{formatCurrency(Number(value) || 0)}</span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-700">Gross Monthly</span>
                  <span className="text-sm font-bold text-blue-700">{formatCurrency(gross)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <SectionHeader icon={User} title="Leave Balances" />
              <div className="space-y-3">
                {[
                  { label: 'Casual Leave (CL)', balance: emp.cl_balance, total: 12, color: 'bg-blue-500' },
                  { label: 'Sick Leave (SL)', balance: emp.sl_balance, total: 12, color: 'bg-purple-500' },
                  { label: 'Earned Leave (EL)', balance: emp.el_balance, total: 15, color: 'bg-green-500' },
                ].map(({ label, balance, total, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-gray-600">{label}</span>
                      <span className="text-xs font-semibold text-gray-800">{balance} / {total}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
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
