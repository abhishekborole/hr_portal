import { useState } from 'react'
import { salaryStructureApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { Calculator, Eye } from 'lucide-react'
import type { SalaryPreview } from '@/types'

export default function PreviewPanel({ structureId }: { structureId: number }) {
  const [ctc, setCtc] = useState('')
  const [preview, setPreview] = useState<SalaryPreview | null>(null)
  const [loading, setLoading] = useState(false)

  async function runPreview() {
    if (!ctc) return
    setLoading(true)
    try {
      const result = await salaryStructureApi.preview(structureId, Number(ctc))
      setPreview(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="bg-blue-50 border-blue-100">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">Preview Calculation</span>
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            type="number"
            placeholder="Annual CTC (e.g. 600000)"
            value={ctc}
            onChange={(e) => setCtc(e.target.value)}
            className="max-w-48 bg-white"
          />
          <Button size="sm" onClick={runPreview} loading={loading} disabled={!ctc}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Calculate
          </Button>
        </div>

        {preview && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Earnings</p>
              {Object.entries(preview.earnings).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-700">{k}</span>
                  <span className="font-medium text-green-700">{formatCurrency(v)}</span>
                </div>
              ))}
              <div className="border-t border-blue-200 mt-1 pt-1 flex justify-between text-xs font-semibold">
                <span>Gross</span>
                <span className="text-green-800">{formatCurrency(preview.gross_monthly)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Structure Deductions</p>
              {Object.keys(preview.deductions).length === 0 ? (
                <p className="text-xs text-gray-400 italic">None defined</p>
              ) : (
                Object.entries(preview.deductions).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-0.5">
                    <span className="text-gray-700">{k}</span>
                    <span className="font-medium text-red-600">− {formatCurrency(v)}</span>
                  </div>
                ))
              )}
              <div className="border-t border-blue-200 mt-2 pt-1">
                <p className="text-xs text-gray-500">Statutory deductions (PF, ESIC, PT, TDS) are calculated automatically at payroll generation time.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
