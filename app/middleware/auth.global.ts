// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { status, data } = useAuth()

  // Skip auth check for public routes
  const publicRoutes = ['/auth/signin', '/auth/signup', '/logout', '/auth/error', '/auth/verify-request']
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

  // If user is not authenticated and trying to access protected route
  if (status.value === 'unauthenticated') {
    return navigateTo('/auth/signin')
  }

  // If authentication is still loading, wait
  if (status.value === 'loading') {
    return
  }

  // Handle role-based access
  const user = data.value?.user as any // Cast to handle extended user properties
  const requiredRole = to.meta.requiredRole

  if (requiredRole && user && (!user.role || user.role !== requiredRole)) {
    return navigateTo('/')
  }
})
