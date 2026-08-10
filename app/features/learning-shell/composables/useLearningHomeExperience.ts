import { computed, onMounted, ref } from "vue";
import type { LearningHomeSnapshot } from "@shared/utils/learning-home.contract";

export function useLearningHomeExperience() {
  const { $api } = useNuxtApp();
  const snapshot = ref<LearningHomeSnapshot | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);
  let loadSequence = 0;

  const dailySpark = computed(() => snapshot.value?.spark ?? null);
  const memoryPostcard = computed(() => snapshot.value?.postcard ?? null);

  async function refresh() {
    const sequence = ++loadSequence;
    isLoading.value = true;
    error.value = null;

    const result = await $api.learning.getHome(new Date().getTimezoneOffset());
    if (sequence !== loadSequence) return;
    if (result.success) {
      snapshot.value = result.data;
    } else {
      error.value = result.error.message;
    }
    isLoading.value = false;
  }

  onMounted(() => void refresh());

  return {
    snapshot,
    dailySpark,
    memoryPostcard,
    isLoading,
    error,
    refresh,
  };
}
