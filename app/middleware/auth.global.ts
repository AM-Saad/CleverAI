// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const { status, data } = useAuth();

  // Skip auth check for API routes (handled by server middleware)
  if (to.path.startsWith("/api/")) {
    return;
  }

  // Handle unauthenticatedOnly pages (like signin, signup)
  // If user is authenticated and tries to access these pages, redirect them away
  
  const authMeta = to.meta.auth as { unauthenticatedOnly?: boolean; navigateAuthenticatedTo?: string } | false | undefined;
  if (authMeta && typeof authMeta === 'object' && authMeta.unauthenticatedOnly) {
    if (status.value === "authenticated") {
      return navigateTo(authMeta.navigateAuthenticatedTo || "/");
    }
    // If unauthenticated, allow access to these pages
    return;
  }

  // Skip auth check if page explicitly sets auth: false
  if (to.meta.auth === false) {
    return;
  }

  // If still loading, wait
  if (status.value === "loading") {
    return;
  }

  // If user is not authenticated and trying to access protected route
  if (status.value === "unauthenticated") {
    return navigateTo("/auth/signin");
  }

  // Handle role-based access (if route defines requiredRole in meta)
  const requiredRole = to.meta.requiredRole as string | undefined;
  if (requiredRole) {
    const user = data.value?.user as { role?: string } | undefined;
    if (!user || !user.role || user.role !== requiredRole) {
      return navigateTo("/");
    }
  }
});
