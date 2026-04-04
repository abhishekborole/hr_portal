import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { authApi, tenantApi } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users } from 'lucide-react'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => tenantApi.getBySlug(slug!),
    enabled: !!slug,
    retry: false,
  })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setError('')
    try {
      const data = await authApi.login(values.username, values.password, slug!)
      login(data)
      navigate(`/${slug}/dashboard`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      setError(msg || 'Login failed')
    }
  }

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm">
          <p className="text-gray-700 font-medium mb-1">Company not found</p>
          <p className="text-sm text-gray-500 mb-4">
            No company found for <span className="font-mono bg-gray-100 px-1 rounded">{slug}</span>
          </p>
          <Link to="/" className="text-sm text-blue-600 hover:underline">← Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 mb-4">
            <Users className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{slug}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="Enter username" {...register('username')} />
              {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Enter password" {...register('password')} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" loading={isSubmitting}>
              Sign In
            </Button>
          </form>
        </div>

        <div className="text-center mt-4 space-y-1">
          <p className="text-sm text-gray-500">
            <Link to="/" className="text-blue-600 hover:underline">← Different company</Link>
          </p>
          <p className="text-sm text-gray-500">
            New company?{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
