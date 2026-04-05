import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Pencil, Trash2, ChevronRight, Calculator } from 'lucide-react'
import StructureDetail from './components/StructureDetail'
import AssignmentsTab from './components/AssignmentsTab'
import type { SalaryStructure } from '@/types'

function typeColor(type: string) {
  return type === 'earning' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
}

type TabKey = 'structures' | 'assignments'

export default function SalaryStructurePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('structures')
  const [selectedStructure, setSelectedStructure] = useState<SalaryStructure | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingStructure, setEditingStructure] = useState<SalaryStructure | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [createErr, setCreateErr] = useState('')

  const { data: structures = [], isLoading } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: salaryStructureApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => salaryStructureApi.create({ name: newName, description: newDesc || undefined }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] })
      setCreatingNew(false)
      setNewName('')
      setNewDesc('')
      setSelectedStructure(created)
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      setCreateErr(e.response?.data?.detail ?? 'Create failed'),
  })

  const updateMutation = useMutation({
    mutationFn: () => salaryStructureApi.update(editingStructure!.id, { name: editName, description: editDesc || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salary-structures'] })
      setEditingStructure(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => salaryStructureApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-structures'] }),
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      alert(e.response?.data?.detail ?? 'Cannot delete'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) => salaryStructureApi.update(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salary-structures'] }),
  })

  if (selectedStructure) {
    return (
      <div>
        <PageHeader title="Salary Structures" subtitle="Design components and assign to employees" />
        <StructureDetail structure={selectedStructure} onBack={() => setSelectedStructure(null)} />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Salary Structures" subtitle="Design dynamic salary components and assign to employees" />

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex gap-2">
          {([['structures', 'Structures'], ['assignments', 'Employee Assignments']] as [TabKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'structures' && (
        <div>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Total Structures</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{structures.length}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Active</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{structures.filter((s) => s.is_active).length}</p>
                </CardContent>
              </Card>
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Inactive</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{structures.filter((s) => !s.is_active).length}</p>
                </CardContent>
              </Card>
            </div>
            <Button size="sm" onClick={() => { setCreatingNew(true); setCreateErr('') }}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Structure
            </Button>
          </div>

          {creatingNew && (
            <Card className="mb-5 border-blue-200 shadow-sm">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Create New Structure</h3>
                  <p className="mt-1 text-xs text-gray-500">Start with the structure name and description, then add components after creation.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Structure Name</Label>
                  <Input placeholder="e.g. Grade A - Tech, Senior Staff" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea rows={2} placeholder="Brief description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                </div>
                {createErr && <p className="text-xs text-red-500">{createErr}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => createMutation.mutate()} loading={createMutation.isPending} disabled={!newName}>
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCreatingNew(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="py-10 text-center text-sm text-gray-400">Loading...</div>
          ) : structures.length === 0 && !creatingNew ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calculator className="mx-auto mb-3 h-10 w-10 text-gray-200" />
                <p className="mb-1 text-sm text-gray-500">No salary structures yet</p>
                <p className="mb-4 text-xs text-gray-400">Create a structure to define dynamic salary components.</p>
                <Button size="sm" onClick={() => setCreatingNew(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Create First Structure
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {structures.map((structure) =>
                editingStructure?.id === structure.id ? (
                  <Card key={structure.id} className="border-blue-200 shadow-sm">
                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Name</Label>
                        <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Description</Label>
                        <Textarea rows={2} value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingStructure(null)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card key={structure.id} className={`cursor-pointer border-gray-200 shadow-sm transition-colors hover:border-blue-300 ${!structure.is_active ? 'opacity-75' : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <button className="flex-1 text-left" onClick={() => setSelectedStructure(structure)}>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{structure.name}</span>
                            {!structure.is_active && <Badge variant="warning">Inactive</Badge>}
                          </div>
                          {structure.description && <p className="mb-3 text-sm text-gray-500">{structure.description}</p>}
                          <div className="mb-3 flex items-center gap-5 text-xs text-gray-500">
                            <span><strong className="text-gray-800">{structure.components.length}</strong> components</span>
                            <span><strong className="text-gray-800">Employer contributions inside CTC</strong></span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {structure.components.slice(0, 6).map((component) => (
                              <span key={component.id} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${typeColor(component.component_type)}`}>
                                {component.name}{component.calc_type !== 'remainder' && ` (${component.calc_type === 'fixed' ? `Rs.${component.value}` : `${Number(component.value).toFixed(2)}%`})`}
                              </span>
                            ))}
                            {structure.components.length > 6 && (
                              <span className="text-[10px] text-gray-400">+{structure.components.length - 6} more</span>
                            )}
                            {structure.components.length === 0 && (
                              <span className="text-xs italic text-gray-400">No components yet - click to add</span>
                            )}
                          </div>
                        </button>

                        <div className="ml-3 flex shrink-0 items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate({ id: structure.id, val: !structure.is_active }) }}
                            className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          >
                            {structure.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingStructure(structure); setEditName(structure.name); setEditDesc(structure.description ?? '') }}
                            className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this structure?')) deleteMutation.mutate(structure.id) }}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <ChevronRight className="ml-1 h-4 w-4 text-gray-300" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'assignments' && <AssignmentsTab />}
    </div>
  )
}
