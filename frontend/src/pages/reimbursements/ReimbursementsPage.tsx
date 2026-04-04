import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { reimbursementApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/utils'
import { PlusCircle, CheckCircle, XCircle, Trash2 } from 'lucide-react'

const CATEGORIES = ['Travel', 'Food', 'Medical', 'Accommodation', 'Communication', 'Office Supplies', 'Other']

const applySchema = z.object({
  category: z.string().min(1, 'Category required'),
  amount: z.string().min(1, 'Amount required').refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Amount must be positive'),
  date: z.string().min(1, 'Date required'),
  description: z.string().optional(),
})
type ApplyForm = z.infer<typeof applySchema>

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

type TabKey = 'history' | 'apply' | 'pending'

export default function ReimbursementsPage() {
  const { user } = useAuth()
  const isEmployee = user?.role === 'employee'
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>(isEmployee ? 'history' : 'pending')
  const [reviewState, setReviewState] = useState<{ id: number; action: 'approved' | 'rejected' } | null>(null)
  const [reviewComment, setReviewComment] = useState('')

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['reimbursements', tab],
    queryFn: () => {
      if (tab === 'pending') return reimbursementApi.list({ status: 'pending' })
      return reimbursementApi.list()
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: { category: string; amount: number; date: string; description?: string }) => reimbursementApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] })
      reset()
      setTab('history' as TabKey)
    },
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, comments }: { id: number; status: 'approved' | 'rejected'; comments: string }) =>
      reimbursementApi.review(id, status, comments),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reimbursements'] })
      setReviewState(null)
      setReviewComment('')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reimbursementApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reimbursements'] }),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ApplyForm>({
    resolver: zodResolver(applySchema),
    defaultValues: { date: new Date().toISOString().split('T')[0] },
  })

  const tabs = isEmployee
    ? [{ key: 'history' as TabKey, label: 'My Requests' }, { key: 'apply' as TabKey, label: 'Submit New' }]
    : [{ key: 'pending' as TabKey, label: 'Pending Approval' }, { key: 'history' as TabKey, label: 'All Requests' }]

  const totalApproved = list.filter((r) => r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0)

  return (
    <div>
      <PageHeader title="Reimbursements" />

      {!isEmployee && (
        <div className="grid grid-cols-3 gap-4 mb-5">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{list.filter((r) => r.status === 'pending').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Total Approved</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalApproved)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">Total Requests</p>
              <p className="text-2xl font-bold text-gray-700">{list.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'apply' && (
        <Card className="max-w-lg">
          <CardContent className="p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Submit Reimbursement Request</h3>
            <form onSubmit={handleSubmit(({ category, amount, date, description }) => createMutation.mutate({ category, amount: Number(amount), date, description }))} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select {...register('category')}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register('amount', { valueAsNumber: false })} />
                  {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" {...register('date')} />
                  {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description / Notes</Label>
                <Textarea placeholder="Brief description of the expense..." {...register('description')} rows={3} />
              </div>
              {createMutation.error && (
                <p className="text-xs text-red-500">Submission failed. Please try again.</p>
              )}
              <Button type="submit" loading={isSubmitting || createMutation.isPending}>
                <PlusCircle className="w-4 h-4 mr-1.5" />
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {(tab === 'history' || tab === 'pending') && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-gray-400">Loading...</div>
            ) : list.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No reimbursement requests found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Applied On</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <>
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Emp #${r.employee_id}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">{r.category}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold">{formatCurrency(Number(r.amount))}</td>
                        <td className="px-4 py-3 text-gray-500">{r.date}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate">{r.description || '—'}</td>
                        <td className="px-4 py-3">{statusBadge(r.status)}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(r.applied_on).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {!isEmployee && r.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => setReviewState({ id: r.id, action: 'approved' })}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                  title="Approve"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setReviewState({ id: r.id, action: 'rejected' })}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isEmployee && r.status === 'pending' && (
                              <button
                                onClick={() => { if (confirm('Cancel this request?')) cancelMutation.mutate(r.id) }}
                                className="p-1 text-red-400 hover:bg-red-50 rounded"
                                title="Cancel"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {reviewState?.id === r.id && (
                        <tr key={`review-${r.id}`} className="bg-gray-50">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-gray-700">
                                {reviewState.action === 'approved' ? 'Approving' : 'Rejecting'} — add comments (optional):
                              </span>
                              <Input
                                className="flex-1 max-w-xs"
                                placeholder="Comments..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                              />
                              <Button
                                size="sm"
                                onClick={() => reviewMutation.mutate({ id: reviewState.id, status: reviewState.action, comments: reviewComment })}
                                loading={reviewMutation.isPending}
                                className={reviewState.action === 'approved' ? '' : 'bg-red-600 hover:bg-red-700'}
                              >
                                Confirm
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setReviewState(null)}>Cancel</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
