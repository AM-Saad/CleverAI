import { ref } from "vue";
import type { APIError } from "~/services/FetchFactory";
import type { Result } from "~/types/Result";
import type {
  CaptureWordResponse,
  GenerateStoryResponse,
  LanguageStats,
  LanguageWord,
  UserLanguagePreferences,
} from "@shared/utils/language.contract";
import { listOfflineEntities } from "../../../utils/offline-v2/repository";
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
  deleteWord: (id: string) => Promise<Result<{ message: string }>>;
  enrollWord: (
    id: string,
  ) => Promise<Result<{ wordId: string; status: string }>>;
  getStats: (params?: {
    targetLanguage?: string;
    nativeLanguage?: string;
  }) => Promise<Result<LanguageStats>>;
};

type RuntimeDeps = {
  api?: LanguageApiPort;
};

const defaultFilters = (): WordBankFilters => ({
  status: "all",
  category: "all",
  hasStory: false,
  search: "",
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

  const getApi = () => deps.api ?? useNuxtApp().$api.language;

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

    const offline = typeof useAuth === "function" && typeof useOfflineRuntime === "function" ? useOfflineRuntime() : null;
    if (offline && !offline.isOnline.value && offline.accountId.value) {
      const local = await listOfflineEntities<UserLanguagePreferences>(offline.accountId.value, "languagePreference");
      const cached = local[0]?.data ?? null;
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

  const fetchWords = async () => {
    const requestId = ++wordsRequestId;
    isFetchingWords.value = true;
    wordBankError.value = null;
    cursor.value = undefined;

    try {
      await ensurePreferences();
      const offline = typeof useAuth === "function" && typeof useOfflineRuntime === "function" ? useOfflineRuntime() : null;
      if (offline && !offline.isOnline.value && offline.accountId.value) {
        let cached = (await listOfflineEntities<LanguageWord>(offline.accountId.value, "languageWord")).map((record) => record.data);
        const filter = wordFilters.value;
        if (filter.status !== "all") cached = cached.filter((word) => word.status === filter.status);
        if (filter.category !== "all") cached = cached.filter((word) => word.category === filter.category);
        if (filter.search.trim()) cached = cached.filter((word) => `${word.word} ${word.translation}`.toLowerCase().includes(filter.search.trim().toLowerCase()));
        words.value = cached;
        categories.value = [...new Set(cached.map((word) => word.category).filter((category): category is string => Boolean(category)))];
        totalWords.value = cached.length;
        statusCounts.value = cached.reduce<Record<string, number>>((all, word) => ({ ...all, [word.status]: (all[word.status] ?? 0) + 1 }), {});
        cursor.value = undefined;
        hasMore.value = false;
        return { words: cached, nextCursor: null, categories: categories.value, totalWords: cached.length, statusCounts: statusCounts.value };
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
    const offline = typeof useAuth === "function" && typeof useOfflineRuntime === "function" ? useOfflineRuntime() : null;
    if (offline && !offline.isOnline.value) {
      await offline.queue({ entity: "languageWord", operation: "languageWord.delete", entityId: id, changedFields: ["deleted"], payload: {} });
      words.value = words.value.filter((word) => word.id !== id);
      return { message: "Saved locally" };
    }
    const result = await getApi().deleteWord(id);
    if (!result.success) {
      wordBankError.value = result.error;
      return null;
    }

    words.value = words.value.filter((word) => word.id !== id);
    void refreshStats();
    return result.data;
  };

  const enrollWord = async (id: string) => {
    const offline = typeof useAuth === "function" && typeof useOfflineRuntime === "function" ? useOfflineRuntime() : null;
    if (offline && !offline.isOnline.value) {
      await offline.queue({ entity: "languageWord", operation: "languageWord.enroll", entityId: id, changedFields: ["status"], payload: {} });
      words.value = words.value.map((word) => word.id === id ? { ...word, status: "enrolled" } : word);
      return { wordId: id, status: "enrolled" };
    }
    const result = await getApi().enrollWord(id);
    if (!result.success) {
      wordBankError.value = result.error;
      return null;
    }

    words.value = words.value.map((word) =>
      word.id === id ? { ...word, status: "enrolled" } : word,
    );
    void refreshStats();
    return result.data;
  };

  const refreshStats = async () => {
    const requestId = ++statsRequestId;
    isLoadingStats.value = true;
    statsError.value = null;

    try {
      await ensurePreferences();
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
    setWordFilters,
    setLatestCapture,
    setLatestStory,
    invalidateWords,
    fetchWords,
    loadMoreWords,
    deleteWord,
    enrollWord,
    refreshStats,
    resetWordBank,
  };
}

const runtime = createLanguageLearningRuntime();

export function useLanguageLearningRuntime() {
  return runtime;
}
