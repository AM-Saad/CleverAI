import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

/** Starts the durable v2 reconciler once per application, independent of SW support. */
export default defineNuxtPlugin(() => {
  const offline = useOfflineRuntime();
  void offline.initialize();
});
