import { useOfflineRuntime } from "./useOfflineRuntime";

/** Clears account-scoped content before ending the server session. */
export function useOfflineLogout() {
  const offline = useOfflineRuntime();
  return async () => offline.clearCurrentAccount();
}
