import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, Plus, Pencil, Trash2, Info, Layers3 } from 'lucide-react'
import PreviewPanel from './PreviewPanel'
import ComponentForm from './ComponentForm'
import type { SalaryStructure, SalaryComponent } from '@/types'

function typeColor(type: string) {
  if (type === 'earning') return 'bg-green-100 text-green-700'
  if (type === 'benefit') return 'bg-blue-100 text-blue-700'
  return 'bg-red-100 text-red-700'
}

function componentFormula(component: SalaryComponent) {
  if (component.calc_type === 'fixed') {
    return `Fixed at Rs.${Number(component.value).toLocaleString()}/month`
  }
  if (component.calc_type === 'remainder') {
    return 'Calculated as the remaining amount after other components'
  }

  const base = component.calc_type === 'percentage_of_basic'
    ? 'Basic'
    : component.calc_type === 'ctc_deduction'
    ? 'CTC before remainder'
    : 'CTC'

  const cap = component.max_value != null ? ` • cap Rs.${Number(component.max_value).toLocaleString()}` : ''
  return `${Number(component.value).toFixed(2)}% of ${base}${cap}`
}

export default function StructureDetail({
  structure, onBack,
}: {
  structure: SalaryStructure
  onBack: () => void
}) {
  const qc = useQueryClient()

  const { data: fresh } = useQuery({
    queryKey: ['structure', structure.id],
    queryFn: () => salaryStructureApi.get(structure.id),
    initialData: structure,
  })

  const [addingComponent, setAddingComponent] = useState(false)
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null)

  const deleteComponentMutation = useMutation({
    mutationFn: (componentId: number) => salaryStructureApi.deleteComponent(fresh!.id, componentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['structure', fresh!.id] })
      qc.invalidateQueries({ queryKey: ['salary-structures'] })
    },
  })

  const components = fresh?.components ?? []
  const earnings = components.filter((component) => component.component_type === 'earning')
  const benefits = components.filter((component) => component.component_type === 'benefit')
  const deductions = components.filter((component) => component.component_type === 'deduction')

  function renderComponentRows(items: SalaryComponent[]) {
    return items.map((component) => (
      <div key={component.id} className="flex items-start justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
              #{component.sort_order}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColor(component.component_type)}`}>
              {component.component_type}
            </span>
            <span className="text-sm font-semibold text-gray-800">{component.name}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{componentFormula(component)}</p>
        </div>

        <div className="ml-4 flex items-center gap-1">
          <button
            onClick={() => { setEditingComponent(component); setAddingComponent(false) }}
            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Remove "${component.name}"?`)) deleteComponentMutation.mutate(component.id) }}
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    ))
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-blue-600 hover:underline">Back to Structures</button>
        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-800">{fresh?.name}</span>
        {!fresh?.is_active && <Badge variant="warning" className="ml-2">Inactive</Badge>}
      </div>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold text-gray-900">{fresh?.name}</h2>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">CTC Included</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            {fresh?.description || 'Build a clean salary breakdown with earnings, deductions, and employer contributions included within annual CTC.'}
          </p>
        </div>
        <PreviewPanel structureId={fresh!.id} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-gray-900">Salary Components</p>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Define the earnings and deductions that make up this structure.</p>
                </div>
                {!addingComponent && !editingComponent && (
                  <Button size="sm" variant="outline" onClick={() => setAddingComponent(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add Component
                  </Button>
                )}
              </div>

              {addingComponent && (
                <div className="mb-4">
                  <ComponentForm
                    structureId={fresh!.id}
                    onDone={() => setAddingComponent(false)}
                  />
                </div>
              )}

              {components.length === 0 && !addingComponent ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center">
                  <p className="mb-1 text-sm font-medium text-gray-700">No components yet</p>
                  <p className="mb-4 text-xs text-gray-400">Start with Basic, HRA, Special Allowance, and employer contributions.</p>
                  <Button size="sm" variant="outline" onClick={() => setAddingComponent(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add First Component
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Earnings</p>
                      <span className="text-[11px] text-gray-400">{earnings.length} item(s)</span>
                    </div>
                    {earnings.length > 0 ? (
                      <div className="space-y-2">
                        {renderComponentRows(earnings)}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-green-200 bg-green-50/40 px-3 py-4 text-xs text-green-700">
                        No earnings components yet.
                      </div>
                    )}
                  </div>

                  <div className="pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Benefits / Employer Contributions</p>
                      <span className="text-[11px] text-gray-400">{benefits.length} item(s)</span>
                    </div>
                    {benefits.length > 0 ? (
                      <div className="space-y-2">
                        {renderComponentRows(benefits)}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50/40 px-3 py-4 text-xs text-blue-700">
                        No benefit components yet.
                      </div>
                    )}
                  </div>

                  <div className="pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Employee Deductions</p>
                      <span className="text-[11px] text-gray-400">{deductions.length} item(s)</span>
                    </div>
                    {deductions.length > 0 ? (
                      <div className="space-y-2">
                        {renderComponentRows(deductions)}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-red-200 bg-red-50/40 px-3 py-4 text-xs text-red-700">
                        No deduction components yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 xl:sticky xl:top-6 self-start">
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <p className="text-sm font-semibold text-gray-900">Calculation Standard</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-800">Employer contributions are included in annual CTC</div>
                <div className="mt-2 text-xs text-gray-500">
                  This structure follows the common India payroll model where Annual CTC equals Gross Salary plus employer contributions such as Employer PF and gratuity.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-semibold text-gray-900">Structure Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-blue-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Components</p>
                  <p className="mt-1 text-xl font-semibold text-blue-900">{components.length}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Status</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">{fresh?.is_active ? 'Active' : 'Inactive'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {editingComponent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingComponent(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Edit Component</p>
                <p className="mt-0.5 text-xs text-gray-500">{editingComponent.name}</p>
              </div>
              <button
                onClick={() => setEditingComponent(null)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <ChevronRight className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="p-5">
              <ComponentForm
                initial={editingComponent}
                structureId={fresh!.id}
                onDone={() => setEditingComponent(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
