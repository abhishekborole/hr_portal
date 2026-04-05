import { type ReactNode, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, FileBadge2, Landmark, MapPin } from 'lucide-react'

import { PageHeader } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { companyApi } from '@/lib/api'
import type { CompanyProfile } from '@/types'

const emptyForm: Partial<CompanyProfile> = {
  name: '',
  legal_name: '',
  gstin: '',
  pan: '',
  tan: '',
  cin: '',
  pf_registration_no: '',
  esi_registration_no: '',
  professional_tax_no: '',
  phone: '',
  email: '',
  website: '',
  registered_address: '',
  corporate_address: '',
  city: '',
  state: '',
  pincode: '',
  country: 'India',
  authorized_signatory: '',
  signatory_designation: '',
}

export default function CompanyPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<CompanyProfile>>(emptyForm)
  const [message, setMessage] = useState('')

  const { data: company, isLoading } = useQuery({
    queryKey: ['company-profile'],
    queryFn: companyApi.get,
  })

  useEffect(() => {
    if (!company) return
    setForm({
      name: company.name || '',
      legal_name: company.legal_name || '',
      gstin: company.gstin || '',
      pan: company.pan || '',
      tan: company.tan || '',
      cin: company.cin || '',
      pf_registration_no: company.pf_registration_no || '',
      esi_registration_no: company.esi_registration_no || '',
      professional_tax_no: company.professional_tax_no || '',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      registered_address: company.registered_address || '',
      corporate_address: company.corporate_address || '',
      city: company.city || '',
      state: company.state || '',
      pincode: company.pincode || '',
      country: company.country || 'India',
      authorized_signatory: company.authorized_signatory || '',
      signatory_designation: company.signatory_designation || '',
    })
  }, [company])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => {
          if (key === 'name') return [key, value]
          return [key, value === '' ? null : value]
        }),
      )
      return companyApi.update(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-profile'] })
      setMessage('Company details updated')
    },
  })

  function setField<K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function resetForm() {
    setMessage('')
    if (company) {
      setForm({
        name: company.name || '',
        legal_name: company.legal_name || '',
        gstin: company.gstin || '',
        pan: company.pan || '',
        tan: company.tan || '',
        cin: company.cin || '',
        pf_registration_no: company.pf_registration_no || '',
        esi_registration_no: company.esi_registration_no || '',
        professional_tax_no: company.professional_tax_no || '',
        phone: company.phone || '',
        email: company.email || '',
        website: company.website || '',
        registered_address: company.registered_address || '',
        corporate_address: company.corporate_address || '',
        city: company.city || '',
        state: company.state || '',
        pincode: company.pincode || '',
        country: company.country || 'India',
        authorized_signatory: company.authorized_signatory || '',
        signatory_designation: company.signatory_designation || '',
      })
      return
    }
    setForm(emptyForm)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        subtitle="Maintain company master data for statutory registrations, contact details, payroll documents, and offer letters."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetForm}>Reset</Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.name}>
              Save Company Details
            </Button>
          </div>
        }
      />

      {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <SectionCard
            icon={<Building2 className="h-4 w-4" />}
            title="Company Identity"
            subtitle="The master company information used across the HR portal."
          >
            <GridForm>
              <FormField label="Company Name">
                <Input value={form.name || ''} onChange={(e) => setField('name', e.target.value)} placeholder="Aareks Technology" />
              </FormField>
              <FormField label="Legal Name">
                <Input value={form.legal_name || ''} onChange={(e) => setField('legal_name', e.target.value)} placeholder="Aareks Technology Private Limited" />
              </FormField>
              <FormField label="Portal Slug">
                <Input value={company?.slug || ''} readOnly className="bg-gray-50 text-gray-500" />
              </FormField>
              <FormField label="Company Email">
                <Input value={form.email || ''} onChange={(e) => setField('email', e.target.value)} placeholder="hello@company.com" />
              </FormField>
              <FormField label="Phone">
                <Input value={form.phone || ''} onChange={(e) => setField('phone', e.target.value)} placeholder="+91 98765 43210" />
              </FormField>
              <FormField label="Website">
                <Input value={form.website || ''} onChange={(e) => setField('website', e.target.value)} placeholder="https://company.com" />
              </FormField>
            </GridForm>
          </SectionCard>

          <SectionCard
            icon={<Landmark className="h-4 w-4" />}
            title="Statutory Registrations"
            subtitle="Keep India compliance identifiers in one place for payroll and document generation."
          >
            <GridForm>
              <FormField label="GSTIN">
                <Input value={form.gstin || ''} onChange={(e) => setField('gstin', e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" />
              </FormField>
              <FormField label="PAN">
                <Input value={form.pan || ''} onChange={(e) => setField('pan', e.target.value.toUpperCase())} placeholder="ABCDE1234F" />
              </FormField>
              <FormField label="TAN">
                <Input value={form.tan || ''} onChange={(e) => setField('tan', e.target.value.toUpperCase())} placeholder="BLRA12345B" />
              </FormField>
              <FormField label="CIN">
                <Input value={form.cin || ''} onChange={(e) => setField('cin', e.target.value.toUpperCase())} placeholder="U12345KA2024PTC000000" />
              </FormField>
              <FormField label="PF Registration No">
                <Input value={form.pf_registration_no || ''} onChange={(e) => setField('pf_registration_no', e.target.value)} placeholder="KN/BNG/1234567/000/0000" />
              </FormField>
              <FormField label="ESI Registration No">
                <Input value={form.esi_registration_no || ''} onChange={(e) => setField('esi_registration_no', e.target.value)} placeholder="12-34-567890-000-0001" />
              </FormField>
              <FormField label="Professional Tax No">
                <Input value={form.professional_tax_no || ''} onChange={(e) => setField('professional_tax_no', e.target.value)} placeholder="PT-REG-123456" />
              </FormField>
            </GridForm>
          </SectionCard>

          <SectionCard
            icon={<MapPin className="h-4 w-4" />}
            title="Address Details"
            subtitle="Use consistent registered and operating address details across employee and offer documents."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FormField label="Registered Address">
                <Textarea value={form.registered_address || ''} onChange={(e) => setField('registered_address', e.target.value)} placeholder="Registered office address" />
              </FormField>
              <FormField label="Corporate Address">
                <Textarea value={form.corporate_address || ''} onChange={(e) => setField('corporate_address', e.target.value)} placeholder="Corporate or operating office address" />
              </FormField>
            </div>
            <GridForm>
              <FormField label="City">
                <Input value={form.city || ''} onChange={(e) => setField('city', e.target.value)} placeholder="Bengaluru" />
              </FormField>
              <FormField label="State">
                <Input value={form.state || ''} onChange={(e) => setField('state', e.target.value)} placeholder="Karnataka" />
              </FormField>
              <FormField label="PIN Code">
                <Input value={form.pincode || ''} onChange={(e) => setField('pincode', e.target.value)} placeholder="560001" />
              </FormField>
              <FormField label="Country">
                <Input value={form.country || ''} onChange={(e) => setField('country', e.target.value)} placeholder="India" />
              </FormField>
            </GridForm>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard
            icon={<FileBadge2 className="h-4 w-4" />}
            title="Authorized Signatory"
            subtitle="Useful for offer letters and company-issued documents."
          >
            <div className="space-y-4">
              <FormField label="Authorized Signatory Name">
                <Input value={form.authorized_signatory || ''} onChange={(e) => setField('authorized_signatory', e.target.value)} placeholder="Priya Sharma" />
              </FormField>
              <FormField label="Designation">
                <Input value={form.signatory_designation || ''} onChange={(e) => setField('signatory_designation', e.target.value)} placeholder="Director - People Operations" />
              </FormField>
            </div>
          </SectionCard>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="space-y-4 p-5">
              <div>
                <p className="text-sm font-semibold text-gray-900">Quick Summary</p>
                <p className="mt-1 text-xs text-gray-500">A compact view of the company profile being used across the portal.</p>
              </div>
              {isLoading ? (
                <p className="text-sm text-gray-500">Loading company details...</p>
              ) : (
                <div className="space-y-3 text-sm text-gray-600">
                  <SummaryRow label="Company" value={form.name} />
                  <SummaryRow label="Legal Name" value={form.legal_name} />
                  <SummaryRow label="GSTIN" value={form.gstin} />
                  <SummaryRow label="PAN" value={form.pan} />
                  <SummaryRow label="Location" value={[form.city, form.state].filter(Boolean).join(', ')} />
                  <SummaryRow label="Website" value={form.website} />
                  <SummaryRow label="Signatory" value={form.authorized_signatory} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SectionCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle: string; children: ReactNode }) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">{icon}</div>
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

function GridForm({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-right text-sm text-gray-700">{value || 'Not set'}</span>
    </div>
  )
}
