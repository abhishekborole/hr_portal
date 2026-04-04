import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { Calculator, TrendingDown, Info } from 'lucide-react'

// ── Tax calculation helpers ───────────────────────────────────────────────────

function calcOldRegimeTax(taxableIncome: number): number {
  let tax = 0
  if (taxableIncome <= 250000) return 0
  if (taxableIncome <= 500000) {
    tax = (taxableIncome - 250000) * 0.05
  } else if (taxableIncome <= 1000000) {
    tax = 250000 * 0.05 + (taxableIncome - 500000) * 0.2
  } else {
    tax = 250000 * 0.05 + 500000 * 0.2 + (taxableIncome - 1000000) * 0.3
  }
  const cess = tax * 0.04
  // Rebate u/s 87A (net income ≤ 5L)
  if (taxableIncome <= 500000) return 0
  return Math.round(tax + cess)
}

function calcNewRegimeTax(taxableIncome: number): number {
  // FY 2024-25 new regime slabs
  let tax = 0
  const slabs = [
    { upto: 300000, rate: 0 },
    { upto: 600000, rate: 0.05 },
    { upto: 900000, rate: 0.1 },
    { upto: 1200000, rate: 0.15 },
    { upto: 1500000, rate: 0.2 },
    { upto: Infinity, rate: 0.3 },
  ]
  let prev = 0
  for (const slab of slabs) {
    if (taxableIncome <= prev) break
    const taxable = Math.min(taxableIncome, slab.upto) - prev
    tax += taxable * slab.rate
    prev = slab.upto
  }
  // Rebate u/s 87A (net income ≤ 7L in new regime)
  if (taxableIncome <= 700000) return 0
  const cess = tax * 0.04
  return Math.round(tax + cess)
}

function SlabTable({ regime }: { regime: 'old' | 'new' }) {
  const oldSlabs = [
    { range: 'Up to ₹2.5L', rate: 'Nil' },
    { range: '₹2.5L – ₹5L', rate: '5%' },
    { range: '₹5L – ₹10L', rate: '20%' },
    { range: 'Above ₹10L', rate: '30%' },
  ]
  const newSlabs = [
    { range: 'Up to ₹3L', rate: 'Nil' },
    { range: '₹3L – ₹6L', rate: '5%' },
    { range: '₹6L – ₹9L', rate: '10%' },
    { range: '₹9L – ₹12L', rate: '15%' },
    { range: '₹12L – ₹15L', rate: '20%' },
    { range: 'Above ₹15L', rate: '30%' },
  ]
  const slabs = regime === 'old' ? oldSlabs : newSlabs
  return (
    <table className="w-full text-xs mt-2">
      <thead>
        <tr className="border-b border-gray-100">
          <th className="text-left py-1.5 text-gray-500 font-medium">Income Range</th>
          <th className="text-right py-1.5 text-gray-500 font-medium">Rate</th>
        </tr>
      </thead>
      <tbody>
        {slabs.map((s) => (
          <tr key={s.range} className="border-b border-gray-50">
            <td className="py-1.5 text-gray-700">{s.range}</td>
            <td className="py-1.5 text-right font-semibold text-gray-800">{s.rate}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ResultBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function TaxCalculatorPage() {
  const [income, setIncome] = useState({ basic: '', hra: '', special: '', other: '' })
  const [deductions, setDeductions] = useState({ sec80c: '', sec80d: '', nps: '', hra_exempt: '', lta: '' })

  const gross = useMemo(() => {
    return (Number(income.basic) + Number(income.hra) + Number(income.special) + Number(income.other)) * 12
  }, [income])

  const results = useMemo(() => {
    if (!gross) return null

    const std_deduction = 50000
    const total_80c = Math.min(Number(deductions.sec80c), 150000)
    const total_80d = Math.min(Number(deductions.sec80d), 25000)
    const total_nps = Math.min(Number(deductions.nps), 50000)
    const hra_exempt = Number(deductions.hra_exempt) || 0
    const lta = Number(deductions.lta) || 0

    const oldTaxableIncome = Math.max(0, gross - std_deduction - total_80c - total_80d - total_nps - hra_exempt - lta)
    const newTaxableIncome = Math.max(0, gross - 75000) // new regime: ₹75k std deduction for salaried

    const oldTax = calcOldRegimeTax(oldTaxableIncome)
    const newTax = calcNewRegimeTax(newTaxableIncome)

    return {
      gross,
      oldTaxableIncome,
      newTaxableIncome,
      oldTax,
      newTax,
      oldDeductions: gross - oldTaxableIncome,
      monthlyOld: Math.round(oldTax / 12),
      monthlyNew: Math.round(newTax / 12),
    }
  }, [gross, deductions])

  function onIncome(key: keyof typeof income, val: string) {
    setIncome((prev) => ({ ...prev, [key]: val }))
  }
  function onDed(key: keyof typeof deductions, val: string) {
    setDeductions((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <div>
      <PageHeader
        title="Income Tax Calculator"
        subtitle="FY 2024-25 · Indian Tax Slabs · Old vs New Regime"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Input columns */}
        <div className="space-y-5">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Calculator className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Monthly Salary Components</h3>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'basic', label: 'Basic Salary (₹/month)' },
                  { key: 'hra', label: 'HRA (₹/month)' },
                  { key: 'special', label: 'Special Allowance (₹/month)' },
                  { key: 'other', label: 'Other Allowances (₹/month)' },
                ] .map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={income[key as keyof typeof income]}
                      onChange={(e) => onIncome(key as keyof typeof income, e.target.value)}
                    />
                  </div>
                ))}
                {gross > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between">
                    <span className="text-xs text-gray-500">Annual Gross</span>
                    <span className="text-sm font-bold text-blue-700">{formatCurrency(gross)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-800 text-sm">Deductions (Old Regime)</h3>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'sec80c', label: '80C (PPF/ELSS/LIC etc.) — max ₹1.5L' },
                  { key: 'sec80d', label: '80D (Health Insurance) — max ₹25K' },
                  { key: 'nps', label: '80CCD(1B) NPS — max ₹50K' },
                  { key: 'hra_exempt', label: 'HRA Exemption' },
                  { key: 'lta', label: 'LTA Exemption' },
                ].map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={deductions[key as keyof typeof deductions]}
                      onChange={(e) => onDed(key as keyof typeof deductions, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-5">
          {!results ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Calculator className="w-12 h-12 mb-3 text-gray-200" />
              <p className="text-sm">Enter your salary components to see tax estimates</p>
            </div>
          ) : (
            <>
              {/* Comparison cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className={`border-2 ${results.oldTax <= results.newTax ? 'border-green-400' : 'border-gray-200'}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Old Regime</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.oldTax)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Annual tax + 4% cess</p>
                      </div>
                      {results.oldTax <= results.newTax && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Better</span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Taxable Income</span>
                        <span className="font-medium">{formatCurrency(results.oldTaxableIncome)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Total Deductions</span>
                        <span className="font-medium text-green-700">− {formatCurrency(results.oldDeductions)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Monthly TDS</span>
                        <span className="font-medium">{formatCurrency(results.monthlyOld)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`border-2 ${results.newTax < results.oldTax ? 'border-green-400' : 'border-gray-200'}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">New Regime</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(results.newTax)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Annual tax + 4% cess</p>
                      </div>
                      {results.newTax < results.oldTax && (
                        <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">Better</span>
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Taxable Income</span>
                        <span className="font-medium">{formatCurrency(results.newTaxableIncome)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Std. Deduction</span>
                        <span className="font-medium text-green-700">− {formatCurrency(75000)}</span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Monthly TDS</span>
                        <span className="font-medium">{formatCurrency(results.monthlyNew)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Savings card */}
              {results.oldTax !== results.newTax && (
                <Card className="bg-blue-50 border-blue-100">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        You can save{' '}
                        <span className="font-bold">{formatCurrency(Math.abs(results.oldTax - results.newTax))}</span>
                        {' '}annually by choosing the{' '}
                        <span className="font-bold">{results.oldTax < results.newTax ? 'Old' : 'New'} Regime</span>.
                        Monthly saving: <span className="font-bold">{formatCurrency(Math.abs(results.monthlyOld - results.monthlyNew))}</span>.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Breakdown bars */}
              <Card>
                <CardContent className="p-5">
                  <h3 className="font-semibold text-gray-800 text-sm mb-4">Income Breakdown</h3>
                  <div className="space-y-3">
                    <ResultBar label="Annual Gross Income" value={results.gross} max={results.gross} color="bg-blue-500" />
                    <ResultBar label="Old Regime — Taxable Income" value={results.oldTaxableIncome} max={results.gross} color="bg-orange-400" />
                    <ResultBar label="New Regime — Taxable Income" value={results.newTaxableIncome} max={results.gross} color="bg-purple-400" />
                    <ResultBar label="Old Regime — Tax Payable" value={results.oldTax} max={results.gross} color="bg-red-400" />
                    <ResultBar label="New Regime — Tax Payable" value={results.newTax} max={results.gross} color="bg-pink-400" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Slab reference */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-1">Old Regime Slabs</h3>
                <p className="text-xs text-gray-400 mb-2">Rebate u/s 87A if income ≤ ₹5L</p>
                <SlabTable regime="old" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mb-1">New Regime Slabs (FY 24-25)</h3>
                <p className="text-xs text-gray-400 mb-2">Rebate u/s 87A if income ≤ ₹7L</p>
                <SlabTable regime="new" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
