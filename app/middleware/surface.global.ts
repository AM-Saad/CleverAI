type AppSurface = "all" | "platform" | "daily" | "learning";

function routeOwner(path: string): Exclude<AppSurface, "all"> {
  if (path === "/day" || path.startsWith("/day/")) return "daily";
  if (
    path === "/learn" ||
    path.startsWith("/learn/") ||
    ["/language", "/materials", "/review", "/workspaces"].some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )
  )
    return "learning";
  return "platform";
}

export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return;
  const config = useRuntimeConfig();
  const surface = config.public.appSurface as AppSurface;
  if (surface === "all" || routeOwner(to.path) === surface) return;

  const base = String(config.public.APP_BASE_URL || window.location.origin);
  const target = new URL(to.fullPath, base).toString();
  if (window.location.href !== target) window.location.assign(target);
  return abortNavigation();
});
