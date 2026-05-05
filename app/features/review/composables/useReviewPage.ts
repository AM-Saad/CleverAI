import type { Workspace } from "@shared/utils/workspace.contract";

type WorkspaceSummary = Pick<Workspace, "id" | "title">;

export const useReviewPage = () => {
  const route = useRoute();
  const { $api } = useNuxtApp();
  const { fetchQueue } = useCardReview();

  const workspaceId = computed(() => {
    const id = route.query.workspaceId;
    return typeof id === "string" ? id : undefined;
  });
  const currentWorkspace = ref<WorkspaceSummary | null>(null);

  const fetchWorkspaceInfo = async () => {
    if (!workspaceId.value) {
      currentWorkspace.value = null;
      return;
    }

    const result = await $api.workspaces.getWorkspace(workspaceId.value);
    currentWorkspace.value = result.success
      ? { id: result.data.id, title: result.data.title }
      : null;
  };

  const pageTitle = computed(() =>
    currentWorkspace.value
      ? `Review: ${currentWorkspace.value.title}`
      : "Spaced Repetition Review",
  );

  const pageSubtitle = computed(() =>
    currentWorkspace.value
      ? `Review cards from "${currentWorkspace.value.title}" workspace`
      : "Review your cards using the spaced repetition algorithm",
  );

  const refreshQueue = () => {
    fetchQueue(workspaceId.value);
  };

  watch(
    workspaceId,
    () => {
      fetchWorkspaceInfo();
      refreshQueue();
    },
    { immediate: true },
  );

  return {
    workspaceId,
    currentWorkspace: readonly(currentWorkspace),
    pageTitle,
    pageSubtitle,
    refreshQueue,
  };
};
