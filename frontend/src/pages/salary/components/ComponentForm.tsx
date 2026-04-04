import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Save } from 'lucide-react'
import type { SalaryComponent } from '@/types'

export default function ComponentForm({
  initial,
  structureId,
  onDone,
}: {
  initial?: SalaryComponent
  structureId: number
  onDone: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<'earning' | 'deduction'>(initial?.component_type ?? 'earning')
  const [calcType, setCalcType] = useState<'fixed' | 'percentage_of_basic' | 'percentage_of_ctc'>(initial?.calc_type ?? 'fixed')
  const [value, setValue] = useState(String(initial?.value ?? ''))
  const [taxable, setTaxable] = useState(initial?.is_taxable ?? true)
  const [order, setOrder] = useState(String(initial?.sort_order ?? 0))
  const [err, setErr] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        component_type: type,
        calc_type: calcType,
        value: Number(value),
        is_taxable: taxable,
        sort_order: Number(order),
      }
      return initial
        ? salaryStructureApi.updateComponent(structureId, initial.id, payload)
        : salaryStructureApi.addComponent(structureId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['structure', structureId] })
      qc.invalidateQueries({ queryKey: ['salary-structures'] })
      onDone()
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setErr(e.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Component Name</Label>
          <Input placeholder="e.g. Basic, HRA, Transport" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as 'earning' | 'deduction')}>
            <option value="earning">Earning</option>
            <option value="deduction">Deduction</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Calculation</Label>
          <Select value={calcType} onChange={(e) => setCalcType(e.target.value as 'fixed' | 'percentage_of_basic' | 'percentage_of_ctc')}>
            <option value="fixed">Fixed Amount (₹)</option>
            <option value="percentage_of_ctc">% of Monthly CTC</option>
            <option value="percentage_of_basic">% of Basic</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{calcType === 'fixed' ? 'Amount (₹/month)' : 'Percentage (%)'}</Label>
          <Input type="number" step="0.01" placeholder={calcType === 'fixed' ? '5000' : '40'} value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sort Order</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id="taxable"
            checked={taxable}
            onChange={(e) => setTaxable(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <label htmlFor="taxable" className="text-xs text-gray-600">Taxable component</label>
        </div>
      </div>
      {err && <p className="text-xs text-red-500 mb-2">{err}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!name || !value}>
          <Save className="w-3.5 h-3.5 mr-1" /> {initial ? 'Update' : 'Add Component'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}
