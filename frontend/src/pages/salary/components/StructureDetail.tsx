import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import ComponentForm from './ComponentForm'
import PreviewPanel from './PreviewPanel'
import type { SalaryStructure } from '@/types'

function calcTypeLabel(t: string) {
  return t === 'fixed' ? 'Fixed (₹)' : t === 'percentage_of_basic' ? '% of Basic' : '% of CTC'
}

function typeColor(type: string) {
  return type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
}

export default function StructureDetail({
  structure,
  onBack,
}: {
  structure: SalaryStructure
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const { data: fresh } = useQuery({
    queryKey: ['structure', structure.id],
    queryFn: () => salaryStructureApi.get(structure.id),
    initialData: structure,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => salaryStructureApi.deleteComponent(fresh!.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['structure', fresh!.id] }),
  })

  const components = fresh?.components ?? []

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="text-blue-600 hover:underline text-sm flex items-center gap-1">
          ← Structures
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-800">{fresh?.name}</span>
        {!fresh?.is_active && <Badge variant="warning" className="ml-2">Inactive</Badge>}
      </div>

      {fresh?.description && (
        <p className="text-sm text-gray-500 mb-4">{fresh.description}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 text-sm">Components ({components.length})</h3>
            {!adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
              </Button>
            )}
          </div>

          {adding && (
            <div className="mb-3">
              <ComponentForm structureId={fresh!.id} onDone={() => setAdding(false)} />
            </div>
          )}

          {components.length === 0 && !adding ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-gray-400 mb-2">No components yet</p>
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add first component
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {components.map((comp) =>
                editingId === comp.id ? (
                  <ComponentForm
                    key={comp.id}
                    structureId={fresh!.id}
                    initial={comp}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={comp.id}
                    className={`flex items-center justify-between p-3 rounded-lg border bg-white ${!comp.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-800">{comp.name}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor(comp.component_type)}`}>
                          {comp.component_type}
                        </span>
                        {!comp.is_taxable && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Non-taxable</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {calcTypeLabel(comp.calc_type)}: {comp.calc_type === 'fixed' ? formatCurrency(comp.value) : `${comp.value}%`}
                        {' · '}Order {comp.sort_order}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingId(comp.id)} className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this component?')) deleteMutation.mutate(comp.id) }}
                        className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-800 text-sm mb-3">Live Preview</h3>
          <PreviewPanel structureId={fresh!.id} />
        </div>
      </div>
    </div>
  )
}
