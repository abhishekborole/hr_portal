import { useState } from 'react'
import { salaryStructureApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Eye, X } from 'lucide-react'
import type { SalaryPreview } from '@/types'

function GrossCtcRow({ preview }: { preview: SalaryPreview }) {
  return (
    <tr className="border-b bg-emerald-50">
      <td className="px-3 py-2 font-semibold text-emerald-800">Annual CTC</td>
      <td className="px-3 py-2 text-right font-bold text-emerald-800">{formatCurrency(preview.monthly_ctc)}</td>
      <td className="px-3 py-2 text-right font-bold text-emerald-800">{formatCurrency(preview.annual_ctc)}</td>
    </tr>
  )
}

export default function PreviewPanel({ structureId }: { structureId: number }) {
  const [open,    setOpen]    = useState(false)
  const [ctc,     setCtc]     = useState('')
  const [preview, setPreview] = useState<SalaryPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  async function runPreview() {
    if (!ctc) return
    setLoading(true); setErr('')
    try {
      setPreview(await salaryStructureApi.preview(structureId, Number(ctc)))
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setErr(msg ?? 'Preview failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(true); setPreview(null); setErr('') }}>
        <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview Salary
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <span className="font-semibold text-gray-800">Salary Preview</span>
                {preview && (
                  <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded font-medium">
                    India standard CTC structure
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              {/* CTC input */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-gray-600">Annual CTC (₹)</label>
                  <Input type="number" placeholder="e.g. 1000000" value={ctc}
                    onChange={(e) => { setCtc(e.target.value); setPreview(null) }}
                    onKeyDown={(e) => e.key === 'Enter' && runPreview()} />
                </div>
                <Button size="sm" onClick={runPreview} loading={loading} disabled={!ctc}>Calculate</Button>
              </div>

              {err && <p className="text-xs text-red-500">{err}</p>}

              {preview && (
                <>
                  {/* CTC header */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Annual CTC</p>
                      <p className="text-sm font-bold text-blue-800">{formatCurrency(preview.annual_ctc)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Monthly CTC</p>
                      <p className="text-sm font-bold text-gray-700">{formatCurrency(preview.monthly_ctc)}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Gross Salary</p>
                      <p className="text-sm font-bold text-emerald-800">{formatCurrency(preview.fixed_pay * 12)}</p>
                    </div>
                  </div>

                  {/* Breakdown table */}
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 border-b text-[10px] text-gray-400">
                          <th className="text-left px-3 py-2 font-medium text-gray-600">Component</th>
                          <th className="text-right px-3 py-2 font-medium">Monthly</th>
                          <th className="text-right px-3 py-2 font-medium">Annual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Earnings */}
                        {Object.entries(preview.earnings).map(([name, val]) => (
                          <tr key={name} className="border-b hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-700">{name}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(val)}</td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">{formatCurrency(val * 12)}</td>
                          </tr>
                        ))}

                        {/* Fixed Pay total */}
                        <tr className="border-b bg-green-50">
                          <td className="px-3 py-2 font-semibold text-green-800">Gross Salary</td>
                          <td className="px-3 py-2 text-right font-bold text-green-800">{formatCurrency(preview.fixed_pay)}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-800">{formatCurrency(preview.fixed_pay * 12)}</td>
                        </tr>


                        {/* Deductions (structural — e.g. Employer PF, Gratuity) */}
                        {Object.entries(preview.employer_contributions).map(([name, val]) => (
                          <tr key={name} className="border-b bg-blue-50/30">
                            <td className="px-3 py-2 text-blue-700">
                              {name}
                              <span className="ml-1 text-[10px] text-blue-400">(employer contribution)</span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-blue-700">{formatCurrency(val)}</td>
                            <td className="px-3 py-2 text-right font-medium text-blue-700">{formatCurrency(val * 12)}</td>
                          </tr>
                        ))}

                        <GrossCtcRow preview={preview} />
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Employee-side deductions like Employee PF, ESIC, Professional Tax, and TDS are handled separately during payroll generation.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
