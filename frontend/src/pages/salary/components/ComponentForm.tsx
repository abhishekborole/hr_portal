import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Save } from 'lucide-react'
import type { SalaryComponent } from '@/types'

type CalcType = 'fixed' | 'percentage_of_basic' | 'percentage_of_ctc' | 'percentage_of_annual_ctc' | 'remainder' | 'ctc_deduction'
type CompType = 'earning' | 'benefit' | 'deduction'
type CalcMethod = 'fixed' | 'percentage' | 'remainder'
type CalcBase = 'ctc' | 'basic'

function calcTypeToUi(ct: CalcType): { method: CalcMethod; base: CalcBase } {
  if (ct === 'fixed')               return { method: 'fixed',      base: 'ctc'   }
  if (ct === 'remainder')           return { method: 'remainder',  base: 'ctc'   }
  if (ct === 'percentage_of_basic') return { method: 'percentage', base: 'basic' }
  /* percentage_of_ctc / ctc_deduction / percentage_of_annual_ctc */
  return { method: 'percentage', base: 'ctc' }
}

function uiToCalcType(method: CalcMethod, base: CalcBase): CalcType {
  if (method === 'fixed')     return 'fixed'
  if (method === 'remainder') return 'remainder'
  if (base   === 'basic')     return 'percentage_of_basic'
  return 'percentage_of_ctc'
}

interface Preset {
  name: string; component_type: CompType; calc_type: CalcType
  value: string; min_value: string; max_value: string; is_taxable: boolean; sort_order: string
}

const PRESETS: Preset[] = [
  { name: 'Basic Salary',                component_type: 'earning',   calc_type: 'percentage_of_ctc',   value: '40.00', min_value: '',  max_value: '',       is_taxable: true,  sort_order: '10'  },
  { name: 'House Rent Allowance (HRA)',   component_type: 'earning',   calc_type: 'percentage_of_basic', value: '40.00', min_value: '',  max_value: '',       is_taxable: true,  sort_order: '20'  },
  { name: 'Dearness Allowance (DA)',      component_type: 'earning',   calc_type: 'percentage_of_basic', value: '10.00', min_value: '',  max_value: '',       is_taxable: true,  sort_order: '30'  },
  { name: 'Special Allowance',           component_type: 'earning',   calc_type: 'remainder',           value: '',      min_value: '',  max_value: '',       is_taxable: true,  sort_order: '40'  },
  { name: 'Conveyance Allowance',        component_type: 'earning',   calc_type: 'fixed',               value: '1600.00',min_value: '', max_value: '',       is_taxable: true,  sort_order: '50'  },
  { name: 'Medical Allowance',           component_type: 'earning',   calc_type: 'fixed',               value: '1250.00',min_value: '', max_value: '',       is_taxable: true,  sort_order: '60'  },
  { name: 'Leave Travel Allowance (LTA)',component_type: 'earning',   calc_type: 'fixed',               value: '0.00',  min_value: '',  max_value: '',       is_taxable: false, sort_order: '70'  },
  { name: 'Performance Bonus',           component_type: 'earning',   calc_type: 'percentage_of_basic', value: '10.00', min_value: '',  max_value: '',       is_taxable: true,  sort_order: '80'  },
  { name: 'Employer PF',                 component_type: 'benefit',   calc_type: 'percentage_of_basic', value: '12.00', min_value: '',  max_value: '1800.00',is_taxable: false, sort_order: '5'   },
  { name: 'Gratuity',                    component_type: 'benefit',   calc_type: 'percentage_of_basic', value: '4.81',  min_value: '',  max_value: '',       is_taxable: false, sort_order: '6'   },
  { name: 'Employee PF',                 component_type: 'deduction', calc_type: 'percentage_of_basic', value: '12.00', min_value: '',  max_value: '1800.00',is_taxable: false, sort_order: '90'  },
  { name: 'ESIC (Employee)',             component_type: 'deduction', calc_type: 'percentage_of_basic', value: '0.75',  min_value: '',  max_value: '',       is_taxable: false, sort_order: '100' },
  { name: 'Professional Tax',            component_type: 'deduction', calc_type: 'fixed',               value: '200.00',min_value: '',  max_value: '',       is_taxable: false, sort_order: '110' },
]

export default function ComponentForm({
  initial, structureId, onDone,
}: {
  initial?: SalaryComponent; structureId: number; onDone: () => void
}) {
  const qc = useQueryClient()
  const initUi = initial ? calcTypeToUi(initial.calc_type) : { method: 'fixed' as CalcMethod, base: 'ctc' as CalcBase }

  const [name,     setName]     = useState(initial?.name ?? '')
  const [compType, setCompType] = useState<CompType>(initial?.component_type ?? 'earning')
  const [method,   setMethod]   = useState<CalcMethod>(initUi.method)
  const [base,     setBase]     = useState<CalcBase>(initUi.base)
  const [value,    setValue]    = useState(initial?.value != null ? Number(initial.value).toFixed(2) : '')
  const [minValue, setMinValue] = useState(initial?.min_value != null ? String(initial.min_value) : '')
  const [maxValue, setMaxValue] = useState(initial?.max_value != null ? String(initial.max_value) : '')
  const [taxable,  setTaxable]  = useState(initial?.is_taxable ?? true)
  const [order,    setOrder]    = useState(String(initial?.sort_order ?? 0))
  const [err,      setErr]      = useState('')

  const calcType  = uiToCalcType(method, base)
  const isPercent = method === 'percentage'

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        component_type: compType,
        calc_type: calcType,
        value: method === 'remainder' ? 0 : Number(value),
        min_value: (isPercent && minValue !== '') ? Number(minValue) : null,
        max_value: (isPercent && maxValue !== '') ? Number(maxValue) : null,
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

  function applyPreset(p: Preset) {
    const ui = calcTypeToUi(p.calc_type)
    setName(p.name); setCompType(p.component_type)
    setMethod(ui.method); setBase(ui.base)
    setValue(p.value); setMinValue(p.min_value); setMaxValue(p.max_value)
    setTaxable(p.is_taxable); setOrder(p.sort_order); setErr('')
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3">
      {!initial && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Quick Templates</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" onClick={() => applyPreset(p)}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  p.component_type === 'earning'
                    ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                    : p.component_type === 'benefit'
                    ? 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                    : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                }`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Component Name</Label>
        <Input placeholder="e.g. Basic, HRA, Transport" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={compType} onChange={(e) => setCompType(e.target.value as CompType)}>
            <option value="earning">Earning</option>
            <option value="benefit">Benefit / Employer Contribution</option>
            <option value="deduction">Deduction</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Calculation Method</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value as CalcMethod)}>
            <option value="fixed">Fixed Amount (₹/month)</option>
            <option value="percentage">Percentage (%)</option>
            <option value="remainder">Remainder of CTC</option>
          </Select>
        </div>
      </div>

      {isPercent && (
        <div className="space-y-1">
          <Label className="text-xs">Calculate on</Label>
          <Select value={base} onChange={(e) => setBase(e.target.value as CalcBase)}>
            <option value="ctc">CTC</option>
            <option value="basic">Basic Salary</option>
          </Select>
        </div>
      )}

      {method === 'remainder' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Amount = Monthly CTC − sum of all earnings computed before this component (by sort order).
        </div>
      )}

      {method !== 'remainder' && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`space-y-1 ${method === 'fixed' ? 'col-span-2' : ''}`}>
            <Label className="text-xs">{method === 'fixed' ? 'Amount (₹/month)' : 'Percentage (%)'}</Label>
            <Input type="number" step="0.01" placeholder={method === 'fixed' ? '5000' : '40'}
              value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          {isPercent && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Min Cap (₹/month) <span className="font-normal text-gray-400">optional</span></Label>
                <Input type="number" step="1" placeholder="e.g. 2000" value={minValue} onChange={(e) => setMinValue(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Cap (₹/month) <span className="font-normal text-gray-400">optional</span></Label>
                <Input type="number" step="1" placeholder="e.g. 1800" value={maxValue} onChange={(e) => setMaxValue(e.target.value)} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Sort Order</Label>
          <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 pb-1 cursor-pointer select-none">
          <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300" />
          <span className="text-xs text-gray-600">Taxable component</span>
        </label>
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending}
          disabled={!name || (method !== 'remainder' && !value)}>
          <Save className="w-3.5 h-3.5 mr-1" /> {initial ? 'Update' : 'Add Component'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}
