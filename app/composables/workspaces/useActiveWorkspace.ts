/**
 * useActiveWorkspace — the single "current workspace" the mobile IA operates on.
 *
 * Notes / board / review / materials are all workspace-scoped, but the mobile
 * shell shows one space at a time (switched via the module-08 sheet). This holds
 * the selected workspace id (persisted to localStorage) and resolves it against
 * the live workspace list, defaulting to the first available space.
 */
import { computed, watch } from "vue";
import type { WorkspaceSummary } from "#shared/utils/workspace.contract";

const STORAGE_KEY = "cognilo:active-workspace";
const RECENTS_KEY = "cognilo:ws-recents";

function loadRecents(): Record<string, number> {
  if (!import.meta.client) return {};
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function useActiveWorkspace() {
  const { workspaces, loading, error, refresh } = useWorkspaces();

  // SSR-safe shared state; hydrated from localStorage on the client.
  const activeId = useState<string | null>("active-workspace-id", () => null);
  // Last-used timestamps drive recents-first ordering in the quick switcher.
  const recents = useState<Record<string, number>>("ws-recents", () => ({}));
  // Global quick-switch sheet open state (mounted once in the shell).
  const isSwitcherOpen = useState<boolean>("ws-switcher-open", () => false);

  if (import.meta.client && activeId.value === null) {
    activeId.value = localStorage.getItem(STORAGE_KEY);
  }
  if (import.meta.client && Object.keys(recents.value).length === 0) {
    recents.value = loadRecents();
  }

  // Keep a valid selection: fall back to the first workspace when the stored id
  // is missing or no longer exists.
  watch(
    workspaces,
    (list) => {
      if (!list?.length) return;
      const exists = activeId.value && list.some((w) => w.id === activeId.value);
      if (!exists) activeId.value = list[0]!.id;
    },
    { immediate: true },
  );

  watch(activeId, (id) => {
    if (import.meta.client && id) localStorage.setItem(STORAGE_KEY, id);
  });

  const activeWorkspace = computed<WorkspaceSummary | null>(
    () => workspaces.value?.find((w) => w.id === activeId.value) ?? null,
  );

  // Workspaces ordered most-recently-used first (active pinned to the top),
  // so the spaces you hop between surface immediately in the switcher.
  const recentWorkspaces = computed<WorkspaceSummary[]>(() => {
    const list = workspaces.value ?? [];
    return [...list].sort((a, b) => {
      if (a.id === activeId.value) return -1;
      if (b.id === activeId.value) return 1;
      return (recents.value[b.id] ?? 0) - (recents.value[a.id] ?? 0);
    });
  });

  function setActive(id: string) {
    activeId.value = id;
    const next = { ...recents.value, [id]: Date.now() };
    recents.value = next;
    if (import.meta.client) localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  }

  function openSwitcher() {
    isSwitcherOpen.value = true;
  }
  function closeSwitcher() {
    isSwitcherOpen.value = false;
  }

  return {
    workspaces,
    loading,
    error,
    refresh,
    activeId,
    activeWorkspace,
    recentWorkspaces,
    setActive,
    isSwitcherOpen,
    openSwitcher,
    closeSwitcher,
  };
}
