export function isServiceWorkerRuntimeEnabled(): boolean {
  if (!import.meta.client) return false;

  const config = useRuntimeConfig();
  return import.meta.env.PROD || Boolean(config.public.serviceWorkerEnabledInDev);
}

export function hasServiceWorkerSupport(): boolean {
  return import.meta.client && "serviceWorker" in navigator;
}

export function canUseServiceWorker(): boolean {
  return hasServiceWorkerSupport() && isServiceWorkerRuntimeEnabled();
}

export async function getServiceWorkerReadyRegistration(
  timeoutMs = 2000,
): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;

  try {
    return await Promise.race<ServiceWorkerRegistration | null>([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

export async function getCurrentServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseServiceWorker()) return null;

  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function getAllServiceWorkerRegistrations(): Promise<ServiceWorkerRegistration[]> {
  if (!hasServiceWorkerSupport()) return [];

  try {
    return Array.from(await navigator.serviceWorker.getRegistrations());
  } catch {
    return [];
  }
}
