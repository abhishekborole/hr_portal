import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, ArrowRight } from 'lucide-react'
import type { SalaryConfig as BasicDrivenConfig } from '@/types'

const DEFAULT_CONFIG: BasicDrivenConfig = {
  basic_pct: 40,
  hra_pct: 40,
  pf_rate: 12,
  pf_capped: true,
  pf_cap: 1800,
  gratuity_rate: 4.81,
  insurance_monthly: 0,
}

function parseConfig(modeConfig?: string | null): BasicDrivenConfig {
  if (!modeConfig) return DEFAULT_CONFIG
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(modeConfig) } }
  catch { return DEFAULT_CONFIG }
}

export default function BasicDrivenConfig({
  structureId,
  modeConfig,
}: {
  structureId: number
  modeConfig?: string | null
}) {
  const qc = useQueryClient()
  const init = parseConfig(modeConfig)

  const [basicPct,     setBasicPct]     = useState(String(init.basic_pct))
  const [hraPct,       setHraPct]       = useState(String(init.hra_pct))
  const [pfRate,       setPfRate]       = useState(String(init.pf_rate))
  const [pfCap,        setPfCap]        = useState(String(init.pf_cap))
  const [gratuityRate, setGratuityRate] = useState(String(init.gratuity_rate))
  const [insurance,    setInsurance]    = useState(String(init.insurance_monthly))
  const [err,          setErr]          = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const config: BasicDrivenConfig = {
        basic_pct:         Number(basicPct),
        hra_pct:           Number(hraPct),
        pf_rate:           Number(pfRate),
        pf_capped:         true,
        pf_cap:            Number(pfCap),
        gratuity_rate:     Number(gratuityRate),
        insurance_monthly: Number(insurance),
      }
      return salaryStructureApi.update(structureId, { mode_config: JSON.stringify(config) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['structure', structureId] })
      qc.invalidateQueries({ queryKey: ['salary-structures'] })
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setErr(e.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div className="space-y-4">
      {/* Calculation flow diagram */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-medium text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
        <span className="text-blue-700 font-semibold">CTC</span>
        <ArrowRight className="w-3 h-3 text-blue-400" />
        <span className="text-green-700">Basic ({basicPct}%)</span>
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <span className="text-green-700">HRA ({hraPct}% of Basic)</span>
        <span className="text-gray-400">+</span>
        <span className="text-red-600">PF ({pfRate}%, cap ₹{pfCap})</span>
        <span className="text-gray-400">+</span>
        <span className="text-red-600">Gratuity ({gratuityRate}%)</span>
        {Number(insurance) > 0 && <><span className="text-gray-400">+</span><span className="text-red-600">Insurance (₹{insurance})</span></>}
        <ArrowRight className="w-3 h-3 text-gray-400" />
        <span className="text-green-700">Special Allowance (balance)</span>
      </div>

      {/* Config form */}
      <div className="grid grid-cols-2 gap-4">

        {/* Basic */}
        <div className="col-span-2 bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Basic Salary</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-gray-500">% of CTC</Label>
              <div className="flex items-center gap-1">
                <Input type="number" step="1" min="10" max="70" value={basicPct} onChange={(e) => setBasicPct(e.target.value)} className="w-24" />
                <span className="text-xs text-gray-500">%</span>
              </div>
            </div>
            <div className="text-xs text-gray-400 leading-snug mt-4">
              Typical: 30–50% of CTC.<br />Most other components derive from Basic.
            </div>
          </div>
        </div>

        {/* HRA */}
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">House Rent Allowance (HRA)</p>
          <div className="flex items-center gap-1">
            <Input type="number" step="1" min="0" max="100" value={hraPct} onChange={(e) => setHraPct(e.target.value)} className="w-20" />
            <span className="text-xs text-gray-500">% of Basic</span>
          </div>
          <p className="text-[10px] text-gray-400">50% metro · 40% non-metro</p>
        </div>

        {/* Employer PF */}
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Employer PF</p>
          <div className="flex items-center gap-1">
            <Input type="number" step="0.01" min="0" value={pfRate} onChange={(e) => setPfRate(e.target.value)} className="w-20" />
            <span className="text-xs text-gray-500">% of Basic</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-gray-500">Cap ₹</span>
            <Input type="number" step="1" min="0" value={pfCap} onChange={(e) => setPfCap(e.target.value)} className="w-24" />
            <span className="text-[10px] text-gray-400">/mo (0 = no cap)</span>
          </div>
        </div>

        {/* Gratuity */}
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Gratuity</p>
          <div className="flex items-center gap-1">
            <Input type="number" step="0.01" min="0" value={gratuityRate} onChange={(e) => setGratuityRate(e.target.value)} className="w-20" />
            <span className="text-xs text-gray-500">% of Basic</span>
          </div>
          <p className="text-[10px] text-gray-400">Statutory: 4.81% (15/26 × 1/12)</p>
        </div>

        {/* Insurance */}
        <div className="bg-white rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Insurance / Other</p>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">₹</span>
            <Input type="number" step="1" min="0" value={insurance} onChange={(e) => setInsurance(e.target.value)} className="w-24" />
            <span className="text-xs text-gray-500">/month</span>
          </div>
          <p className="text-[10px] text-gray-400">0 = not applicable</p>
        </div>

      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
        <strong>Special Allowance</strong> is auto-calculated as the balance: CTC − Basic − HRA − Employer PF − Gratuity − Insurance
      </div>

      {err && <p className="text-xs text-red-500">{err}</p>}

      <Button size="sm" onClick={() => mutation.mutate()} loading={mutation.isPending}>
        <Save className="w-3.5 h-3.5 mr-1" /> Save Configuration
      </Button>
    </div>
  )
}
