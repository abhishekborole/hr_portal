import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { salaryStructureApi, employeeApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { Eye, Users, X } from 'lucide-react'
import type { SalaryPreview, Employee } from '@/types'

export default function AssignmentsTab() {
  const qc = useQueryClient()
  const [assignState, setAssignState] = useState<{ empId: number; empName: string; currentStructureId?: number; currentCtc?: number } | null>(null)
  const [selStructure, setSelStructure] = useState('')
  const [ctcInput, setCtcInput] = useState('')
  const [preview, setPreview] = useState<SalaryPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', { is_active: true }],
    queryFn: () => employeeApi.list({ is_active: true }),
  })

  const { data: structures = [] } = useQuery({
    queryKey: ['salary-structures'],
    queryFn: salaryStructureApi.list,
  })

  const assignMutation = useMutation({
    mutationFn: () => salaryStructureApi.assign(assignState!.empId, Number(selStructure), Number(ctcInput)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      setAssignState(null)
      setSelStructure('')
      setCtcInput('')
      setPreview(null)
    },
  })

  const removeMutation = useMutation({
    mutationFn: (empId: number) => salaryStructureApi.removeAssignment(empId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  async function handlePreview() {
    if (!selStructure || !ctcInput) return
    setPreviewLoading(true)
    try {
      const result = await salaryStructureApi.preview(Number(selStructure), Number(ctcInput))
      setPreview(result)
    } finally {
      setPreviewLoading(false)
    }
  }

  function openAssign(emp: Employee) {
    setAssignState({ empId: emp.id, empName: `${emp.first_name} ${emp.last_name}`, currentStructureId: emp.structure_id, currentCtc: emp.annual_ctc })
    setSelStructure(emp.structure_id ? String(emp.structure_id) : '')
    setCtcInput(emp.annual_ctc ? String(emp.annual_ctc) : '')
    setPreview(null)
  }

  const structureMap = Object.fromEntries(structures.map((s) => [s.id, s.name]))

  return (
    <div>
      {assignState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Assign Salary Structure</h3>
                <p className="text-xs text-gray-500 mt-0.5">{assignState.empName}</p>
              </div>
              <button onClick={() => setAssignState(null)} className="p-1.5 rounded text-gray-400 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Salary Structure</Label>
                <Select value={selStructure} onChange={(e) => { setSelStructure(e.target.value); setPreview(null) }}>
                  <option value="">Select structure</option>
                  {structures.filter((s) => s.is_active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Annual CTC (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 600000"
                  value={ctcInput}
                  onChange={(e) => { setCtcInput(e.target.value); setPreview(null) }}
                />
                {ctcInput && <p className="text-xs text-gray-400">Monthly: {formatCurrency(Number(ctcInput) / 12)}</p>}
              </div>

              {selStructure && ctcInput && (
                <Button size="sm" variant="outline" onClick={handlePreview} loading={previewLoading}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview Breakdown
                </Button>
              )}

              {preview && (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Monthly Breakdown</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                    {Object.entries(preview.earnings).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-gray-600">{k}</span>
                        <span className="font-medium text-green-700">{formatCurrency(v)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-semibold">
                    <span>Gross Monthly</span>
                    <span className="text-green-700">{formatCurrency(preview.gross_monthly)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Net pay will be calculated after statutory deductions during payroll generation.</p>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Button
                onClick={() => assignMutation.mutate()}
                loading={assignMutation.isPending}
                disabled={!selStructure || !ctcInput}
              >
                Assign Structure
              </Button>
              <Button variant="outline" onClick={() => setAssignState(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400">No active employees.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Designation</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Structure</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Annual CTC</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Monthly Gross</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{emp.first_name} {emp.last_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{emp.emp_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{emp.designation ?? '—'}</td>
                    <td className="px-4 py-3">
                      {emp.structure_id
                        ? <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{structureMap[emp.structure_id] ?? `Structure #${emp.structure_id}`}</span>
                        : <span className="text-xs text-gray-400 italic">Legacy (flat salary)</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {emp.annual_ctc ? formatCurrency(Number(emp.annual_ctc)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {emp.basic_salary
                        ? formatCurrency(
                            (Number(emp.basic_salary) || 0) + (Number(emp.hra) || 0) +
                            (Number(emp.special_allowance) || 0) + (Number(emp.conveyance_allowance) || 0) +
                            (Number(emp.medical_allowance) || 0)
                          )
                        : '—'
                      }
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openAssign(emp)}>
                          <Users className="w-3 h-3 mr-1" />
                          {emp.structure_id ? 'Change' : 'Assign'}
                        </Button>
                        {emp.structure_id && (
                          <button
                            onClick={() => { if (confirm('Remove structure assignment?')) removeMutation.mutate(emp.id) }}
                            className="p-1.5 rounded text-red-400 hover:bg-red-50"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
