import { isRef } from 'vue'

export default defineNuxtRouteMiddleware((to) => {
  const { data } = useAuth()
  const user = isRef(data) && data.value && data.value.user ? data.value.user : null

  if (!user) {
    return navigateTo('/auth/signin')
  }
  const requiredRole = to.meta.requiredRole
  if (
    requiredRole &&
    (!user.role || user.role !== requiredRole)
  ) {
    return navigateTo('/')
  }
})
