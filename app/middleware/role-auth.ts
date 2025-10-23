// app/middleware/role-auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const { status, data } = useAuth();

  // If user is not authenticated
  if (status.value === "unauthenticated") {
    return navigateTo("/auth/signin");
  }

  // If still loading, wait
  if (status.value === "loading") {
    return;
  }

  const user = data.value?.user as any;
  if (!user) {
    return navigateTo("/auth/signin");
  }

  const requiredRole = to.meta.requiredRole;
  if (requiredRole && (!user.role || user.role !== requiredRole)) {
    return navigateTo("/");
  }
});
