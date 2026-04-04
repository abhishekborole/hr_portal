import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: ('admin' | 'manager' | 'employee')[]
}

export default function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, tenantSlug } = useAuth()
  const { slug } = useParams<{ slug: string }>()

  const effectiveSlug = slug ?? tenantSlug

  if (!user) return <Navigate to={effectiveSlug ? `/${effectiveSlug}/login` : '/'} replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`/${effectiveSlug ?? user.tenant_slug}/dashboard`} replace />
  }

  return <>{children}</>
}
