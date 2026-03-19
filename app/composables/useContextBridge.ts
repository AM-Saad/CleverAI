import { ref, computed } from "vue";
import type { Flashcard, SourceRef } from "~/shared/utils/flashcard.contract";

/**
 * Context Bridge Store - Manages source context preview for flashcards/questions
 * Following the pattern of useNotesStore for consistency
 */

// ==========================================
// Types
// ==========================================

export interface ContextPreview {
  type: "NOTE" | "PDF";
  materialId?: string;
  noteId?: string;
  anchor: string; // blockId or page number
  title?: string; // Material or folder title for display
}

interface ContextBridgeState {
  activePreview: ContextPreview | null;
  isSlideOverOpen: boolean;
  isLoading: boolean;
  error: string | null;
}

// ==========================================
// Store State
// ==========================================

const state = ref<ContextBridgeState>({
  activePreview: null,
  isSlideOverOpen: false,
  isLoading: false,
  error: null,
});

/**
 * Context Bridge Composable
 * Provides local-first source context management
 */
export function useContextBridge() {
  const { $api } = useNuxtApp();
  const toast = useToast();
  const notesStore = useNotesStore; // Will be called with folderId when needed

  // ==========================================
  // Getters
  // ==========================================

  const activePreview = computed(() => state.value.activePreview);
  const isSlideOverOpen = computed(() => state.value.isSlideOverOpen);
  const isLoading = computed(() => state.value.isLoading);
  const hasError = computed(() => !!state.value.error);

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Locate and preview the source for a card
   * Checks if source is already in view (Note context) or needs Slide-Over
   */
  const locateSource = async (
    card: Flashcard | any,
    currentFolderId?: string
  ) => {
    if (!card.sourceRef) {
      toast.add({
        title: "No source reference",
        description: "This card doesn't have a source reference attached.",
        color: "warning",
      });
      return;
    }

    const sourceRef = card.sourceRef as SourceRef;
    state.value.isLoading = true;
    state.value.error = null;

    try {
      // Determine source type and open appropriate context
      if (sourceRef.type === "NOTE") {
        await openNoteContext(sourceRef, currentFolderId);
      } else if (sourceRef.type === "PDF") {
        await openPdfContext(sourceRef);
      }
    } catch (error) {
      console.error("Failed to locate source:", error);
      state.value.error =
        error instanceof Error ? error.message : "Unknown error";

      // Handle orphaned source
      if ((error as any)?.status === 404) {
        toast.add({
          title: "Source not found",
          description: "The original source material has been deleted.",
          color: "error",
        });
      } else {
        toast.add({
          title: "Error",
          description: "Failed to locate source context.",
          color: "error",
        });
      }
    } finally {
      state.value.isLoading = false;
    }
  };

  /**
   * Open note context - checks if already in view or opens Slide-Over
   */
  const openNoteContext = async (
    sourceRef: SourceRef,
    currentFolderId?: string
  ) => {
    // Check if we're already viewing the correct note
    if (currentFolderId) {
      const store = notesStore(currentFolderId);
      const note = store.getNote?.(sourceRef.anchor) || null;

      if (note) {
        // Same note in view - just scroll to block
        scrollToBlock(sourceRef.anchor);
        return;
      }
    }

    // Different context - open in Slide-Over
    state.value.activePreview = {
      type: "NOTE",
      noteId: sourceRef.anchor,
      anchor: sourceRef.anchor,
      materialId: sourceRef.materialId,
    };
    state.value.isSlideOverOpen = true;
  };

  /**
   * Open PDF context in Slide-Over
   */
  const openPdfContext = async (sourceRef: SourceRef) => {
    if (!sourceRef.materialId) {
      throw new Error("PDF source reference missing materialId");
    }

    // Fetch material metadata to verify it exists
    const result = await $api.materials.getMaterial(sourceRef.materialId);

    if (!result.success) {
      throw result.error;
    }

    state.value.activePreview = {
      type: "PDF",
      materialId: sourceRef.materialId,
      anchor: sourceRef.anchor, // Page number
      title: result.data.title,
    };
    state.value.isSlideOverOpen = true;
  };

  /**
   * Scroll to a specific block in the current note editor
   */
  const scrollToBlock = (blockId: string) => {
    // Use nextTick to ensure DOM is ready
    nextTick(() => {
      const element = document.querySelector(`[data-block-id="${blockId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add highlight effect
        element.classList.add("highlight-block");
        setTimeout(() => {
          element.classList.remove("highlight-block");
        }, 2000);
      }
    });
  };

  /**
   * Close the Slide-Over preview
   */
  const closePreview = () => {
    state.value.isSlideOverOpen = false;
    state.value.activePreview = null;
    state.value.error = null;
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    state.value.error = null;
  };

  /**
   * Bulk enroll draft items
   */
  const bulkEnroll = async (
    itemIds: string[],
    itemType: "flashcard" | "question"
  ): Promise<boolean> => {
    if (!itemIds.length) return false;

    state.value.isLoading = true;
    try {
      // Call API to update status to ENROLLED
      const result =
        itemType === "flashcard"
          ? await $api.folders.bulkEnrollFlashcards(itemIds)
          : await $api.folders.bulkEnrollQuestions(itemIds);

      if (result.success) {
        toast.add({
          title: "Success",
          description: `Enrolled ${result.data.enrolledCount} ${itemType}s for review`,
          color: "success",
        });
        return true;
      } else {
        throw result.error;
      }
    } catch (error) {
      console.error("Bulk enroll failed:", error);
      toast.add({
        title: "Error",
        description: `Failed to enroll ${itemType}s`,
        color: "error",
      });
      return false;
    } finally {
      state.value.isLoading = false;
    }
  };

  // ==========================================
  // Return Store Interface
  // ==========================================

  return {
    // State
    activePreview,
    isSlideOverOpen,
    isLoading,
    hasError,

    // Actions
    locateSource,
    closePreview,
    clearError,
    bulkEnroll,
  };
}
