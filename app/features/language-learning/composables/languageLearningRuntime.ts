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
};

type LanguageApiPort = {
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
  enrollWord: (id: string) => Promise<Result<{ wordId: string; status: string }>>;
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

  const words = ref<LanguageWord[]>([]);
  const categories = ref<string[]>([]);
  const cursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const wordFilters = ref<WordBankFilters>(defaultFilters());
  const isFetchingWords = ref(false);
  const isLoadingMoreWords = ref(false);
  const wordBankError = ref<APIError | null>(null);

  const stats = ref<LanguageStats | null>(null);
  const isLoadingStats = ref(false);
  const statsError = ref<APIError | null>(null);

  const getApi = () => deps.api ?? useNuxtApp().$api.language;

  const languageParams = () => ({
    targetLanguage: preferences.value?.targetLanguage,
    nativeLanguage: preferences.value?.nativeLanguage,
  });

  const toWordQuery = (append: boolean) => ({
    limit: 50,
    ...(append && cursor.value ? { cursor: cursor.value } : {}),
    status:
      wordFilters.value.status === "all" ? undefined : wordFilters.value.status,
    category:
      wordFilters.value.category === "all"
        ? undefined
        : wordFilters.value.category,
    hasStory: wordFilters.value.hasStory ? true : undefined,
    search: wordFilters.value.search.trim() || undefined,
    ...languageParams(),
  });

  const setPreferences = (nextPreferences: UserLanguagePreferences | null) => {
    preferences.value = nextPreferences;
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
    isFetchingWords.value = true;
    wordBankError.value = null;
    cursor.value = undefined;

    const result = await getApi().getWords(toWordQuery(false));
    isFetchingWords.value = false;

    if (!result.success) {
      wordBankError.value = result.error;
      return null;
    }

    words.value = result.data.words ?? [];
    categories.value = result.data.categories ?? [];
    cursor.value = result.data.nextCursor ?? undefined;
    hasMore.value = !!result.data.nextCursor;
    return result.data;
  };

  const loadMoreWords = async () => {
    if (!cursor.value) return null;
    isLoadingMoreWords.value = true;
    wordBankError.value = null;

    const result = await getApi().getWords(toWordQuery(true));
    isLoadingMoreWords.value = false;

    if (!result.success) {
      wordBankError.value = result.error;
      return null;
    }

    words.value = [...words.value, ...(result.data.words ?? [])];
    cursor.value = result.data.nextCursor ?? undefined;
    hasMore.value = !!result.data.nextCursor;
    return result.data;
  };

  const deleteWord = async (id: string) => {
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
    isLoadingStats.value = true;
    statsError.value = null;

    const result = await getApi().getStats(languageParams());
    isLoadingStats.value = false;

    if (!result.success) {
      statsError.value = result.error;
      return null;
    }

    stats.value = result.data;
    return result.data;
  };

  const resetWordBank = () => {
    words.value = [];
    categories.value = [];
    cursor.value = undefined;
    hasMore.value = false;
    wordBankError.value = null;
    wordFilters.value = defaultFilters();
  };

  return {
    preferences,
    wordBankRevision,
    latestCapture,
    latestStory,
    words,
    categories,
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
