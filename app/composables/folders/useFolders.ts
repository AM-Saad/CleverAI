import { z } from "zod";
import { APIError } from "~/services/FetchFactory";

const FolderResponse = z
  .union([FolderSchema, z.object({ data: FolderSchema })])
  .transform((x) => ("id" in x ? x : x.data));
const FoldersResponse = z
  .union([z.array(FolderSchema), z.object({ data: z.array(FolderSchema) })])
  .transform((x) => (Array.isArray(x) ? x : x.data));

// Simplified schema assignments without problematic ZodOut type
const FoldersResponseSchema = FoldersResponse;
const FolderResponseSchema = FolderResponse;

export function useFolders() {
  const { $api } = useNuxtApp();

  const { data, pending, error, refresh } = useDataFetch<Folder[]>(
    "folders",
    () => $api.folders.getFolders(FoldersResponseSchema),
  );
  return {
    folders: data,
    loading: pending,
    error,
    refresh,
  };
}

export function useCreateFolder() {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const createOperation = useOperation<Folder>();

  const createFolder = async (payload: typeof CreateFolderDTO) => {
    return await createOperation.execute(async () => {
      return await $api.folders.postFolder(payload);
    });
  };

  return {
    createFolder,
    creating: createOperation.pending,
    error: createOperation.error,
    typedError: createOperation.typedError,
  };
}

export const useFolder = (id: string) => {
  const { $api } = useNuxtApp();

  const { data, pending, error, refresh } = useDataFetch<Folder>(
    `folder-${id}`,
    () => $api.folders.getFolder(id, FolderResponseSchema),
  );

  return {
    folder: data,
    loading: pending,
    error,
    refresh,
  };
};

export function useDeleteFolder(id: string) {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const deleteOperation = useOperation<{ success: boolean }>();

  const deleteFolder = async () => {
    return await deleteOperation.execute(async () => {
      return await $api.folders.deleteFolder(id);
    });
  };

  return {
    deleteFolder,
    deleting: deleteOperation.pending,
    error: deleteOperation.error,
    typedError: deleteOperation.typedError,
    result: deleteOperation.data,
  };
}

export function useUpdateFolder(id: string) {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const updateOperation = useOperation<Folder>();

  const updateFolder = async (
    payload: typeof UpdateFolderDTO | Record<string, unknown>,
  ) => {
    return await updateOperation.execute(async () => {
      return await $api.folders.updateFolder(id, payload);
    });
  };

  return {
    updateFolder,
    updating: updateOperation.pending,
    error: updateOperation.error,
    typedError: updateOperation.typedError,
  };
}

export function useGenerateFlashcards(
  model: Ref<string | undefined>,
  text: Ref<string | undefined>,
  folderId: Ref<string | undefined>,
) {
  const flashcards = ref<Array<{ front: string; back: string }>>([]);
  const generating = ref(false);
  const genError = ref<string | null>(null);
  const rateLimitRemaining = ref<number | null>(null);
  const rateLimitRemainingUser = ref<number | null>(null);
  const rateLimitRemainingIP = ref<number | null>(null);
  const toast = useToast();

  // Add subscription info
  const {
    subscriptionInfo,
    isQuotaExceeded,
    updateFromHeaders,
    updateFromData,
    handleApiError,
  } = useSubscription();

  async function generate() {
    genError.value = null;
    flashcards.value = [];

    const m = model.value?.trim();
    const t = text.value?.trim();
    const fid = folderId.value;

    if (!t) {
      genError.value =
        "This folder has no content yet. Add text or materials, then try again.";
      return;
    }
    if (!m) {
      genError.value = "No LLM model selected for this folder.";
      return;
    }

    generating.value = true;
    try {
      const resp = await $fetch.raw("/api/llm.generate", {
        method: "POST",
        body: {
          model: m,
          task: "flashcards",
          text: t,
          folderId: fid,
          save: !!fid,
          replace: true,
        },
      });

      // Handle rate limit headers
      const h = resp.headers;
      const remAllStr = h?.get?.("x-ratelimit-remaining");
      const remUserStr = h?.get?.("x-ratelimit-remaining-user");
      const remIpStr = h?.get?.("x-ratelimit-remaining-ip");
      const remAll = typeof remAllStr === "string" ? Number(remAllStr) : NaN;
      const remUser = typeof remUserStr === "string" ? Number(remUserStr) : NaN;
      const remIp = typeof remIpStr === "string" ? Number(remIpStr) : NaN;
      rateLimitRemaining.value = Number.isNaN(remAll) ? null : remAll;
      rateLimitRemainingUser.value = Number.isNaN(remUser) ? null : remUser;
      rateLimitRemainingIP.value = Number.isNaN(remIp) ? null : remIp;

      // Handle quota/subscription headers
      updateFromHeaders(resp.headers);

      if (!Number.isNaN(remAll) && remAll <= 1) {
        try {
          toast.add({
            title: "Heads up",
            description:
              "You're about to hit the rate limit. Try again in a minute.",
          });
        } catch {
          // Ignore toast errors
        }
      }

      const data = resp._data ?? resp;
      const parsed = LLMGenerateResponse.parse(data);

      // Update subscription from response data
      if (parsed.subscription) {
        updateFromData({ subscription: parsed.subscription });
      }

      // Show remaining quota toast if low
      if (
        subscriptionInfo.value.tier === "FREE" &&
        subscriptionInfo.value.remaining <= 3
      ) {
        try {
          const toast = typeof useToast === "function" ? useToast() : null;
          toast?.add({
            title: "Free Tier Limit",
            description: `You have ${subscriptionInfo.value.remaining} generations left in your free quota.`,
          });
        } catch {
          // Ignore toast errors
        }
      }

      if (parsed.task === "flashcards") {
        try {
          if (typeof parsed.savedCount === "number") {
            toast.add({
              title: "Saved",
              description: `Saved ${parsed.savedCount} flashcards to this folder.`,
            });
          }
        } catch {
          // Ignore toast errors
        }
        flashcards.value = parsed.flashcards;
      } else {
        genError.value =
          "Server returned a quiz payload when flashcards were requested.";
      }
    } catch (err) {
      handleApiError(err);
      genError.value = "Generation failed. Please try again.";
      flashcards.value = [];
    } finally {
      generating.value = false;
    }
  }

  return {
    flashcards,
    generating,
    genError,
    generate,
    rateLimitRemaining,
    rateLimitRemainingUser,
    rateLimitRemainingIP,
    // New subscription-related properties
    subscriptionInfo,
    isQuotaExceeded,
  };
}

export function useGenerateQuiz(
  model: Ref<string | undefined>,
  text: Ref<string | undefined>,
  folderId: Ref<string | undefined>,
) {
  type Question = { question: string; choices: string[]; answerIndex: number };
  const questions = ref<Question[]>([]);
  const generating = ref(false);
  const genError = ref<APIError | null>(null);
  const rateLimitRemaining = ref<number | null>(null);
  const rateLimitRemainingUser = ref<number | null>(null);
  const rateLimitRemainingIP = ref<number | null>(null);
  const toast = useToast();

  // Add subscription info
  // const {
  //   subscriptionInfo,
  //   isQuotaExceeded,
  //   updateFromHeaders,
  //   updateFromData,
  //   handleApiError
  // } = useSubscription()

  async function generate() {
    genError.value = null;
    questions.value = [];

    const m = model.value?.trim();
    const t = text.value?.trim();
    const fid = folderId.value;

    if (!t) {
      genError.value = new APIError(
        "This folder has no content yet. Add text or materials, then try again.",
      );
      return;
    }
    if (!m) {
      genError.value = new APIError("No LLM model selected for this folder.");
      return;
    }

    generating.value = true;
    try {
      const resp = await $fetch.raw("/api/llm.generate", {
        method: "POST",
        body: {
          model: m,
          task: "quiz",
          text: t,
          folderId: fid,
          save: !!fid,
          replace: true,
        },
      });
      const h = resp.headers;
      const remAllStr = h?.get?.("x-ratelimit-remaining");
      const remUserStr = h?.get?.("x-ratelimit-remaining-user");
      const remIpStr = h?.get?.("x-ratelimit-remaining-ip");
      const remAll = typeof remAllStr === "string" ? Number(remAllStr) : NaN;
      const remUser = typeof remUserStr === "string" ? Number(remUserStr) : NaN;
      const remIp = typeof remIpStr === "string" ? Number(remIpStr) : NaN;
      rateLimitRemaining.value = Number.isNaN(remAll) ? null : remAll;
      rateLimitRemainingUser.value = Number.isNaN(remUser) ? null : remUser;
      rateLimitRemainingIP.value = Number.isNaN(remIp) ? null : remIp;
      if (!Number.isNaN(remAll) && remAll <= 1) {
        try {
          toast.add({
            title: "Heads up",
            description:
              "You’re about to hit the rate limit. Try again in a minute.",
          });
        } catch {
          // Ignore toast errors
        }
      }
      const data = resp._data ?? resp;
      const parsed = LLMGenerateResponse.parse(data);
      if (parsed.task === "quiz") {
        try {
          if (typeof parsed.savedCount === "number") {
            toast.add({
              title: "Saved",
              description: `Saved ${parsed.savedCount} questions to this folder.`,
            });
          }
        } catch {
          // Ignore toast errors
        }
        questions.value = parsed.quiz;
      } else {
        genError.value = new APIError(
          "Server returned a flashcards payload when quiz was requested.",
        );
      }
    } catch (err) {
      genError.value = new APIError(
        err instanceof Error ? err.message : "Generation failed.",
      );
      questions.value = [];
    } finally {
      generating.value = false;
    }
  }

  return {
    questions,
    generating,
    genError,
    generate,
    rateLimitRemaining,
    rateLimitRemainingUser,
    rateLimitRemainingIP,
  };
}
