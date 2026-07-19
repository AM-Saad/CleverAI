import { ref, watch } from "vue";
import type { APIError } from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import type {
  CaptureWordResponse,
  GenerateStoryResponse,
  LanguagePreferencesDTO,
  LanguageStats,
  LanguageWord,
  UserLanguagePreferences,
} from "@shared/utils/language.contract";
import {
  getOfflineEntity,
  listOfflineEntities,
  putOfflineEntities,
} from "../../../utils/offline-v2/repository";
import { useOfflineRuntime } from "../../../composables/offline/useOfflineRuntime";

type WordBankFilters = {
  status: string;
  category: string;
  hasStory: boolean;
  search: string;
};

type WordsResult = {
  words: LanguageWord[];
  nextCursor: string | null;
  categories?: string[];
  totalWords?: number;
  statusCounts?: Record<string, number>;
};

type LanguageApiPort = {
  getPreferences?: () => Promise<Result<UserLanguagePreferences>>;
  updatePreferences?: (
    data: Partial<LanguagePreferencesDTO>,
  ) => Promise<Result<UserLanguagePreferences>>;
  getWords: (params?: {
    status?: string;
    category?: string;
    hasStory?: boolean;
    search?: string;
    targetLanguage?: string;
    nativeLanguage?: string;
    limit?: number;
    cursor?: string;
  }) => Promise<Result<WordsResult>>;
  deleteWord: (id: string) => Promise<
    Result<{
      message: string;
      projection?: CaptureWordResponse["projection"];
    }>
  >;
  enrollWord: (id: string) => Promise<
    Result<{
      wordId: string;
      status: LanguageWord["status"];
      projection?: CaptureWordResponse["projection"];
    }>
  >;
  getStats: (params?: {
    targetLanguage?: string;
    nativeLanguage?: string;
  }) => Promise<Result<LanguageStats>>;
};

type RuntimeDeps = {
  api?: LanguageApiPort;
  offline?: ReturnType<typeof useOfflineRuntime>;
};

const defaultFilters = (): WordBankFilters => ({
  status: "all",
  category: "all",
  hasStory: false,
  search: "",
});

const defaultPreferences = (accountId: string): UserLanguagePreferences => ({
  id: "languagePreference",
  userId: accountId,
  enabled: true,
  targetLanguage: "en",
  nativeLanguage: "en",
  translateOnCapture: true,
  autoEnroll: true,
  sessionCardLimit: 12,
  showConsent: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export function createLanguageLearningRuntime(deps: RuntimeDeps = {}) {
  const preferences = ref<UserLanguagePreferences | null>(null);
  const wordBankRevision = ref(0);
  const latestCapture = ref<CaptureWordResponse | null>(null);
  const latestStory = ref<GenerateStoryResponse | null>(null);
  const isLoadingPreferences = ref(false);
  const preferencesError = ref<APIError | null>(null);

  const words = ref<LanguageWord[]>([]);
  const categories = ref<string[]>([]);
  const totalWords = ref(0);
  const statusCounts = ref<Record<string, number>>({});
  const cursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const wordFilters = ref<WordBankFilters>(defaultFilters());
  const isFetchingWords = ref(false);
  const isLoadingMoreWords = ref(false);
  const wordBankError = ref<APIError | null>(null);

  const stats = ref<LanguageStats | null>(null);
  const isLoadingStats = ref(false);
  const statsError = ref<APIError | null>(null);
  let preferencesRequest: Promise<UserLanguagePreferences | null> | null = null;
  let wordsRequestId = 0;
  let statsRequestId = 0;
  let ownerAccountId: string | null | undefined;

  const getApi = () => deps.api ?? useNuxtApp().$api.language;
  const getOffline = () =>
    deps.offline ??
    (typeof useAuth === "function" && typeof useOfflineRuntime === "function"
      ? useOfflineRuntime()
      : null);

  const toWordQuery = (append: boolean) => ({
    limit: 50,
    // Word bank is the full saved library. Language-pair scoping belongs to
    // capture/review, otherwise preference changes make existing words vanish.
    ...(append && cursor.value ? { cursor: cursor.value } : {}),
    status:
      wordFilters.value.status === "all" ? undefined : wordFilters.value.status,
    category:
      wordFilters.value.category === "all"
        ? undefined
        : wordFilters.value.category,
    hasStory: wordFilters.value.hasStory ? true : undefined,
    search: wordFilters.value.search.trim() || undefined,
  });

  const setPreferences = (nextPreferences: UserLanguagePreferences | null) => {
    preferences.value = nextPreferences;
    preferencesError.value = null;
  };

  const ensurePreferences = async () => {
    if (preferences.value) return preferences.value;
    if (preferencesRequest) return preferencesRequest;

    const offline = getOffline();
    if (offline && !offline.isOnline.value && offline.accountId.value) {
      const local = await listOfflineEntities<UserLanguagePreferences>(
        offline.accountId.value,
        "languagePreference",
      );
      const cached = local[0]?.data
        ? {
            ...local[0].data,
            nativeLanguage:
              String(local[0].data.nativeLanguage) === "auto"
                ? "en"
                : local[0].data.nativeLanguage,
            translateOnCapture:
              typeof local[0].data.translateOnCapture === "boolean"
                ? local[0].data.translateOnCapture
                : true,
          }
        : defaultPreferences(offline.accountId.value);
      preferences.value = cached;
      return cached;
    }
    const api = getApi();
    if (!api.getPreferences) return null;

    isLoadingPreferences.value = true;
    preferencesError.value = null;
    preferencesRequest = api
      .getPreferences()
      .then((result) => {
        if (!result.success) {
          preferencesError.value = result.error;
          return null;
        }
        preferences.value = result.data;
        return result.data;
      })
      .finally(() => {
        isLoadingPreferences.value = false;
        preferencesRequest = null;
      });

    return preferencesRequest;
  };

  const setWordFilters = (nextFilters: Partial<WordBankFilters>) => {
    wordFilters.value = { ...wordFilters.value, ...nextFilters };
  };

  const setLatestCapture = (result: CaptureWordResponse | null) => {
    latestCapture.value = result;
  };

  const setLatestStory = (result: GenerateStoryResponse | null) => {
    latestStory.value = result;
  };

  const invalidateWords = () => {
    wordBankRevision.value++;
  };

  const applyServerProjection = async (
    projection?: CaptureWordResponse["projection"],
  ) => {
    const offline = getOffline();
    if (!projection?.length || !offline?.accountId.value) return;
    await putOfflineEntities(
      projection.map((item) => ({
        id: `${offline.accountId.value}:${item.entity}:${item.entityId}`,
        accountId: offline.accountId.value!,
        entity: item.entity,
        entityId: item.entityId,
        version: item.version,
        updatedAt: Date.now(),
        deleted: item.canonical.deleted === true,
        localDirty: false,
        data: item.canonical,
      })),
    );
  };

  const fetchWords = async () => {
    const requestId = ++wordsRequestId;
    isFetchingWords.value = true;
    wordBankError.value = null;
    cursor.value = undefined;

    try {
      await ensurePreferences();
      const offline = getOffline();
      if (offline && !offline.isOnline.value && offline.accountId.value) {
        const allCached = (
          await listOfflineEntities<LanguageWord>(
            offline.accountId.value,
            "languageWord",
          )
        ).map((record) => record.data);
        if (requestId !== wordsRequestId) return null;
        let cached = allCached;
        const filter = wordFilters.value;
        if (filter.status !== "all")
          cached = cached.filter((word) => word.status === filter.status);
        if (filter.category !== "all")
          cached = cached.filter((word) => word.category === filter.category);
        if (filter.hasStory)
          cached = cached.filter((word) => Boolean(word.stories?.length));
        if (filter.search.trim())
          cached = cached.filter((word) =>
            `${word.word} ${word.translation}`
              .toLowerCase()
              .includes(filter.search.trim().toLowerCase()),
          );
        words.value = cached;
        categories.value = [
          ...new Set(
            allCached
              .map((word) => word.category)
              .filter((category): category is string => Boolean(category)),
          ),
        ].sort();
        totalWords.value = allCached.length;
        statusCounts.value = allCached.reduce<Record<string, number>>(
          (all, word) => ({
            ...all,
            [word.status]: (all[word.status] ?? 0) + 1,
          }),
          {},
        );
        cursor.value = undefined;
        hasMore.value = false;
        return {
          words: cached,
          nextCursor: null,
          categories: categories.value,
          totalWords: allCached.length,
          statusCounts: statusCounts.value,
        };
      }
      const result = await getApi().getWords(toWordQuery(false));
      if (requestId !== wordsRequestId) return null;

      if (!result.success) {
        wordBankError.value = result.error;
        return null;
      }

      words.value = result.data.words ?? [];
      categories.value = result.data.categories ?? [];
      totalWords.value = result.data.totalWords ?? words.value.length;
      statusCounts.value = result.data.statusCounts ?? {};
      cursor.value = result.data.nextCursor ?? undefined;
      hasMore.value = !!result.data.nextCursor;
      return result.data;
    } finally {
      if (requestId === wordsRequestId) isFetchingWords.value = false;
    }
  };

  const loadMoreWords = async () => {
    if (!cursor.value) return null;
    const requestId = ++wordsRequestId;
    isLoadingMoreWords.value = true;
    wordBankError.value = null;

    try {
      await ensurePreferences();
      const result = await getApi().getWords(toWordQuery(true));
      if (requestId !== wordsRequestId) return null;

      if (!result.success) {
        wordBankError.value = result.error;
        return null;
      }

      words.value = [...words.value, ...(result.data.words ?? [])];
      totalWords.value = result.data.totalWords ?? totalWords.value;
      statusCounts.value = result.data.statusCounts ?? statusCounts.value;
      cursor.value = result.data.nextCursor ?? undefined;
      hasMore.value = !!result.data.nextCursor;
      return result.data;
    } finally {
      if (requestId === wordsRequestId) isLoadingMoreWords.value = false;
    }
  };

  const deleteWord = async (id: string) => {
    const offline = getOffline();
    if (offline && !offline.isOnline.value) {
      await offline.queue({
        entity: "languageWord",
        operation: "languageWord.delete",
        entityId: id,
        changedFields: ["deleted"],
        payload: {},
      });
      words.value = words.value.filter((word) => word.id !== id);
      return { message: "Saved locally" };
    }
    const previousIndex = words.value.findIndex((word) => word.id === id);
    const previousWord =
      previousIndex >= 0 ? words.value[previousIndex] : undefined;
    words.value = words.value.filter((word) => word.id !== id);
    const result = await getApi().deleteWord(id);
    if (!result.success) {
      if (previousWord && !words.value.some((word) => word.id === id)) {
        const restored = [...words.value];
        restored.splice(
          Math.min(previousIndex, restored.length),
          0,
          previousWord,
        );
        words.value = restored;
      }
      wordBankError.value = result.error;
      return null;
    }

    await applyServerProjection(result.data.projection);
    void refreshStats();
    return result.data;
  };

  const enrollWord = async (id: string) => {
    const offline = getOffline();
    if (offline && !offline.isOnline.value) {
      if (!offline.accountId.value) {
        throw new Error("Sign in once before enrolling words offline.");
      }
      const currentRecord = await getOfflineEntity<LanguageWord>(
        offline.accountId.value,
        "languageWord",
        id,
      );
      const currentWord =
        currentRecord?.data ?? words.value.find((word) => word.id === id);
      if (!currentWord) {
        throw new Error("This word is not available in the offline pack.");
      }
      const existingReviews = await listOfflineEntities<Record<string, any>>(
        offline.accountId.value,
        "languageReview",
      );
      const existingReview = existingReviews.find(
        (record) => record.data.wordId === id,
      );
      const localReviewId =
        existingReview?.entityId ??
        `local:language-review:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      const updatedWord = { ...currentWord, status: "enrolled" as const };
      const queued = await offline.queue({
        entity: "languageWord",
        operation: "languageWord.enroll",
        entityId: id,
        changedFields: ["status"],
        payload: existingReview ? {} : { localReviewId },
        localData: updatedWord,
      });
      if (!existingReview) {
        const now = new Date().toISOString();
        const latestStory = currentWord.stories?.[0] ?? null;
        await putOfflineEntities([
          {
            id: `${offline.accountId.value}:languageReview:${localReviewId}`,
            accountId: offline.accountId.value,
            entity: "languageReview",
            entityId: localReviewId,
            version: 0,
            updatedAt: Date.now(),
            // The pending word enrollment owns this projection. Keeping it
            // non-dirty lets the acknowledgement install the canonical review.
            localDirty: false,
            data: {
              id: localReviewId,
              userId: offline.accountId.value,
              wordId: id,
              storyId: latestStory?.id ?? null,
              intervalDays: 0,
              easeFactor: 2.5,
              repetitions: 0,
              nextReviewAt: now,
              lastReviewedAt: null,
              lastGrade: null,
              streak: 0,
              suspended: false,
              createdAt: now,
              updatedAt: now,
            },
          },
        ]);
      }
      words.value = words.value.map((word) =>
        word.id === id ? updatedWord : word,
      );
      return {
        wordId: queued.entityId,
        status: "enrolled" as const,
      };
    }
    const previousWord = words.value.find((word) => word.id === id);
    words.value = words.value.map((word) =>
      word.id === id ? { ...word, status: "enrolled" as const } : word,
    );
    const result = await getApi().enrollWord(id);
    if (!result.success) {
      if (previousWord) {
        words.value = words.value.map((word) =>
          word.id === id ? previousWord : word,
        );
      }
      wordBankError.value = result.error;
      return null;
    }

    words.value = words.value.map((word) =>
      word.id === id ? { ...word, status: "enrolled" } : word,
    );
    await applyServerProjection(result.data.projection);
    void refreshStats();
    return result.data;
  };

  const refreshStats = async () => {
    const requestId = ++statsRequestId;
    isLoadingStats.value = true;
    statsError.value = null;

    try {
      await ensurePreferences();
      const offline = getOffline();
      if (offline && !offline.isOnline.value && offline.accountId.value) {
        const [localWords, localReviews] = await Promise.all([
          listOfflineEntities<LanguageWord>(
            offline.accountId.value,
            "languageWord",
          ),
          listOfflineEntities<Record<string, any>>(
            offline.accountId.value,
            "languageReview",
          ),
        ]);
        if (requestId !== statsRequestId) return null;
        const data: LanguageStats = {
          total: localWords.length,
          enrolled: localWords.filter(
            (record) => record.data.status === "enrolled",
          ).length,
          mastered: localWords.filter(
            (record) => record.data.status === "mastered",
          ).length,
          due: localReviews.filter(
            (record) =>
              !record.data.suspended &&
              new Date(record.data.nextReviewAt).getTime() <= Date.now(),
          ).length,
        };
        stats.value = data;
        return data;
      }
      const result = await getApi().getStats();
      if (requestId !== statsRequestId) return null;

      if (!result.success) {
        statsError.value = result.error;
        return null;
      }

      stats.value = result.data;
      return result.data;
    } finally {
      if (requestId === statsRequestId) isLoadingStats.value = false;
    }
  };

  const resetWordBank = () => {
    words.value = [];
    categories.value = [];
    totalWords.value = 0;
    statusCounts.value = {};
    cursor.value = undefined;
    hasMore.value = false;
    wordBankError.value = null;
    wordFilters.value = defaultFilters();
  };

  const updatePreferences = async (data: Partial<LanguagePreferencesDTO>) => {
    const offline = getOffline();
    if (offline && !offline.isOnline.value) {
      if (!offline.accountId.value) {
        throw new Error("Sign in once before changing preferences offline.");
      }
      const next = {
        ...(preferences.value ?? {}),
        ...data,
        updatedAt: new Date(),
      } as UserLanguagePreferences;
      await offline.queue({
        entity: "languagePreference",
        operation: "languagePreference.update",
        entityId: preferences.value?.id ?? "languagePreference",
        changedFields: Object.keys(data),
        payload: data,
        localData: next as unknown as Record<string, unknown>,
      });
      setPreferences(next);
      invalidateWords();
      return next;
    }
    const api = getApi();
    if (!api.updatePreferences) return null;
    const result = await api.updatePreferences(data);
    if (!result.success) {
      preferencesError.value = result.error;
      return null;
    }
    if (offline?.accountId.value) {
      await putOfflineEntities([
        {
          id: `${offline.accountId.value}:languagePreference:${result.data.id}`,
          accountId: offline.accountId.value,
          entity: "languagePreference",
          entityId: result.data.id,
          version: result.data.offlineVersion ?? 0,
          updatedAt: Date.now(),
          localDirty: false,
          data: result.data as unknown as Record<string, unknown>,
        },
      ]);
    }
    setPreferences(result.data);
    invalidateWords();
    return result.data;
  };

  const reset = () => {
    wordsRequestId++;
    statsRequestId++;
    preferencesRequest = null;
    preferences.value = null;
    preferencesError.value = null;
    latestCapture.value = null;
    latestStory.value = null;
    stats.value = null;
    statsError.value = null;
    resetWordBank();
  };

  const setAccountScope = (accountId: string | null) => {
    if (ownerAccountId === accountId) return;
    ownerAccountId = accountId;
    reset();
  };

  return {
    preferences,
    isLoadingPreferences,
    preferencesError,
    wordBankRevision,
    latestCapture,
    latestStory,
    words,
    categories,
    totalWords,
    statusCounts,
    cursor,
    hasMore,
    wordFilters,
    isFetchingWords,
    isLoadingMoreWords,
    wordBankError,
    stats,
    isLoadingStats,
    statsError,
    setPreferences,
    ensurePreferences,
    updatePreferences,
    setWordFilters,
    setLatestCapture,
    setLatestStory,
    invalidateWords,
    applyServerProjection,
    fetchWords,
    loadMoreWords,
    deleteWord,
    enrollWord,
    refreshStats,
    resetWordBank,
    reset,
    setAccountScope,
  };
}

const runtimes = new WeakMap<
  object,
  ReturnType<typeof createLanguageLearningRuntime>
>();
const runtimeListeners = new WeakSet<object>();

export function useLanguageLearningRuntime() {
  const nuxtApp = useNuxtApp();
  const offline = useOfflineRuntime();
  let runtime = runtimes.get(nuxtApp as object);
  if (!runtime) {
    // Resolve Nuxt-owned dependencies during setup. Runtime actions execute
    // later, when calling a composable to rediscover them is not safe.
    runtime = createLanguageLearningRuntime({
      offline,
      api: nuxtApp.$api.language,
    });
    runtimes.set(nuxtApp as object, runtime);
  }
  runtime.setAccountScope(offline.accountId.value ?? null);
  watch(offline.accountId, (accountId) =>
    runtime?.setAccountScope(accountId ?? null),
  );
  if (import.meta.client && !runtimeListeners.has(runtime)) {
    runtimeListeners.add(runtime);
    window.addEventListener("offline-v2-sync-result", (event) => {
      const detail = (
        event as CustomEvent<{
          entity?: string;
          status?: string;
          operation?: string;
          syncedPayload?: Record<string, unknown>;
        }>
      ).detail;
      if (detail?.entity !== "languageWord") return;
      if (detail.status === "rejected") {
        void (async () => {
          if (
            detail.operation === "languageWord.enroll" &&
            typeof detail.syncedPayload?.localReviewId === "string" &&
            offline.accountId.value
          ) {
            const localReview = await getOfflineEntity<Record<string, unknown>>(
              offline.accountId.value,
              "languageReview",
              detail.syncedPayload.localReviewId,
            );
            if (localReview) {
              await putOfflineEntities([
                { ...localReview, deleted: true, updatedAt: Date.now() },
              ]);
            }
          }
          await Promise.all([runtime?.fetchWords(), runtime?.refreshStats()]);
        })();
      } else if (detail.status === "applied") {
        runtime?.invalidateWords();
      }
    });
  }
  return runtime;
}
