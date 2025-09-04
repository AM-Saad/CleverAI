// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { status, data } = useAuth()

  // Skip auth check for public routes
  const publicRoutes = ['/auth/signin', '/auth/signup', '/logout', '/auth/error', '/auth/verify-request', '/auth/signIn', '/auth/register']
  if (publicRoutes.includes(to.path)) {
    return
  }

  // Skip auth check for API routes (handled by server middleware)
  if (to.path.startsWith('/api/')) {
    return
  }

  // Skip auth check if page explicitly sets auth: false
  if (to.meta.auth === false) {
    return
  }

  // If authentication is still loading, show loading state but don't block
  if (status.value === 'loading') {
    // Add a timeout to prevent infinite loading
    setTimeout(() => {
      if (status.value === 'loading') {
        console.warn('Authentication took too long, redirecting to sign in')
        navigateTo('/auth/signin')
      }
    }, 10000) // 10 second timeout
    return
  }

  // If user is not authenticated and trying to access protected route
  if (status.value === 'unauthenticated') {
    console.log('User not authenticated, redirecting to sign in')
    return navigateTo('/auth/signin')
  }

  // Handle role-based access
  const user = data.value?.user as { role?: string } | undefined
  const requiredRole = to.meta.requiredRole as string | undefined

  if (requiredRole && user && (!user.role || user.role !== requiredRole)) {
    console.warn(`User role ${user.role} does not match required role ${requiredRole}`)
    return navigateTo('/')
  }
})
