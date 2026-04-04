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

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {([['structures', 'Structures'], ['assignments', 'Employee Assignments']] as [TabKey, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'structures' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{structures.length} structure(s) defined</p>
            <Button size="sm" onClick={() => { setCreatingNew(true); setCreateErr('') }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> New Structure
            </Button>
          </div>

          {creatingNew && (
            <Card className="mb-4 border-blue-200">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm text-gray-800">Create New Structure</h3>
                <div className="space-y-1.5">
                  <Label className="text-xs">Structure Name</Label>
                  <Input placeholder="e.g. Grade A – Tech, Senior Staff" value={newName} onChange={(e) => setNewName(e.target.value)} />
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
                <Calculator className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-1">No salary structures yet</p>
                <p className="text-xs text-gray-400 mb-4">Create a structure to define dynamic salary components</p>
                <Button size="sm" onClick={() => setCreatingNew(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Create First Structure
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {structures.map((s) =>
                editingStructure?.id === s.id ? (
                  <Card key={s.id} className="border-blue-200">
                    <CardContent className="p-4 space-y-3">
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
                  <Card key={s.id} className={`cursor-pointer hover:border-blue-300 transition-colors ${!s.is_active ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <button className="text-left flex-1" onClick={() => setSelectedStructure(s)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800">{s.name}</span>
                            {!s.is_active && <Badge variant="warning">Inactive</Badge>}
                          </div>
                          {s.description && <p className="text-xs text-gray-500 mb-2">{s.description}</p>}
                          <div className="flex gap-2 flex-wrap">
                            {s.components.slice(0, 6).map((c) => (
                              <span key={c.id} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeColor(c.component_type)}`}>
                                {c.name} ({c.calc_type === 'fixed' ? `₹${c.value}` : `${c.value}%`})
                              </span>
                            ))}
                            {s.components.length > 6 && (
                              <span className="text-[10px] text-gray-400">+{s.components.length - 6} more</span>
                            )}
                            {s.components.length === 0 && (
                              <span className="text-xs text-gray-400 italic">No components — click to add</span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleActiveMutation.mutate({ id: s.id, val: !s.is_active }) }}
                            className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingStructure(s); setEditName(s.name); setEditDesc(s.description ?? '') }}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (confirm('Delete this structure?')) deleteMutation.mutate(s.id) }}
                            className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
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
