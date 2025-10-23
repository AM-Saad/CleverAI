// app/middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  console.log("🔐 [AUTH MIDDLEWARE] Starting auth check for route:", to.path);
  console.log(
    "🔐 [AUTH MIDDLEWARE] TEMPORARILY DISABLED - allowing all routes",
  );

  // TEMPORARY: Disable all auth checks to isolate the rendering issue
  return;

  const { status, data } = useAuth();
  console.log("🔐 [AUTH MIDDLEWARE] Auth status:", status.value);
  console.log("🔐 [AUTH MIDDLEWARE] Auth data:", data.value);

  // Skip auth check for public routes
  const publicRoutes = [
    "/auth/signin",
    "/auth/signup",
    "/logout",
    "/auth/error",
    "/auth/verify-request",
    "/auth/signIn",
    "/auth/register",
  ];
  if (publicRoutes.includes(to.path)) {
    console.log("🔐 [AUTH MIDDLEWARE] Public route, skipping auth check");
    return;
  }

  // Skip auth check for API routes (handled by server middleware)
  if (to.path.startsWith("/api/")) {
    console.log("🔐 [AUTH MIDDLEWARE] API route, skipping auth check");
    return;
  }

  // Skip auth check if page explicitly sets auth: false
  if (to.meta.auth === false) {
    console.log(
      "🔐 [AUTH MIDDLEWARE] Route has auth: false, skipping auth check",
    );
    return;
  }

  // If authentication is still loading, allow page to render but don't redirect
  if (status.value === "loading") {
    console.log(
      "🔐 [AUTH MIDDLEWARE] Auth status is loading, allowing page to render anyway",
    );
    // Don't block the render, just log and continue
    // Add a timeout to prevent infinite loading
    setTimeout(() => {
      if (status.value === "loading") {
        console.warn(
          "🔐 [AUTH MIDDLEWARE] Authentication took too long, redirecting to sign in",
        );
        navigateTo("/auth/signin");
      }
    }, 10000); // 10 second timeout
    // Don't return here - let the page render
  }

  // If user is not authenticated and trying to access protected route
  if (status.value === "unauthenticated") {
    console.log(
      "🔐 [AUTH MIDDLEWARE] User not authenticated, redirecting to sign in",
    );
    return navigateTo("/auth/signin");
  }

  // Handle role-based access
  const user = data.value?.user as { role?: string } | undefined;
  const requiredRole = to.meta.requiredRole as string | undefined;

  if (requiredRole && user && (!user.role || user.role !== requiredRole)) {
    console.warn(
      `🔐 [AUTH MIDDLEWARE] User role ${user.role} does not match required role ${requiredRole}`,
    );
    return navigateTo("/");
  }

  console.log("🔐 [AUTH MIDDLEWARE] Auth check completed successfully");
});
