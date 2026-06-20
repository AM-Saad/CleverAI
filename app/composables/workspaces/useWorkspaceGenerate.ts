// app/composables/workspaces/useWorkspaceGenerate.ts
import { ref } from "vue";
import type { Workspace } from "@@/shared/utils/workspace.contract";

type WorkspaceMaterial = NonNullable<Workspace["materials"]>[number];

/**
 * Quota-guarded "turn a material into cards" action for the workspaces list.
 *
 * Reuses the same gateway + credits/subscription guards as
 * `useGenerateFromMaterial` (the per-material flow on the detail page) so the
 * list-page Generate affordance behaves identically — without duplicating the
 * confirmation/regeneration UI that only the detail page needs.
 */
export function useWorkspaceGenerate(refresh?: () => unknown | Promise<unknown>) {
  const { $api } = useNuxtApp();
  const toast = useToast();
  const { subscriptionInfo, isQuotaExceeded, updateFromData, handleApiError } =
    useSubscriptionStore();
  const creditsStore = useCreditsStore();

  // Workspace id currently generating — drives per-row loading state.
  const generatingId = ref<string | null>(null);

  /**
   * Materials in this workspace that no flashcard derives from (precise
   * coverage gap). `materialId` lives on the passthrough flashcard relation, so
   * it survives at runtime even though it isn't on the inferred type.
   */
  function materialsWithoutCards(workspace: Workspace): WorkspaceMaterial[] {
    const materials = workspace.materials ?? [];
    if (!materials.length) return [];
    const covered = new Set(
      (workspace.flashcards ?? [])
        .map((card) => (card as { materialId?: string }).materialId)
        .filter((id): id is string => Boolean(id)),
    );
    return materials.filter((material) => material.id && !covered.has(material.id));
  }

  /**
   * Generate flashcards from the first uncovered material that has usable
   * content. Re-runnable: each click covers one more material, so the action
   * naturally persists (and respects quota) until the workspace is fully
   * covered.
   */
  async function generateForWorkspace(workspace: Workspace) {
    if (generatingId.value) return;

    const target = materialsWithoutCards(workspace).find(
      (material) => (material.content?.trim().length ?? 0) >= 10,
    );
    if (!target?.id) {
      toast.add({
        title: "Nothing to generate",
        description: "Add a material with some content first.",
        color: "warning",
      });
      return;
    }

    // Gate on local balance; the server is authoritative and also spends/blocks.
    if (!creditsStore.hasCredits && isQuotaExceeded.value) {
      creditsStore.openWallet();
      return;
    }

    generatingId.value = workspace.id;
    try {
      const result = await $api.gateway.generateFlashcards(target.content!.trim(), {
        materialId: target.id,
        workspaceId: workspace.id,
        save: true,
        generationConfig: { depth: "balanced" },
      });

      if (result.subscription) updateFromData({ subscription: result.subscription });

      toast.add({
        title: "Cards generated",
        description: `Generated ${result.savedCount ?? 0} flashcards from “${target.title}”.`,
        color: "success",
      });

      window.dispatchEvent(new CustomEvent("refresh-review-stats"));
      await refresh?.();
    } catch (err: unknown) {
      const statusCode =
        (err as { statusCode?: number })?.statusCode ??
        (err as { data?: { statusCode?: number } })?.data?.statusCode;
      if (statusCode === 402) {
        creditsStore.openWallet();
        return;
      }
      handleApiError?.(err);
      toast.add({
        title: "Generation failed",
        description: (err as Error)?.message || "Please try again.",
        color: "error",
      });
    } finally {
      generatingId.value = null;
    }
  }

  return {
    generatingId,
    subscriptionInfo,
    materialsWithoutCards,
    generateForWorkspace,
  };
}
