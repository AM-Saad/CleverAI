<template>
  <section class="space-y-4" :class="compact ? '' : ''">
    <ui-loader v-if="isLoading" :is-fetching="true" />
    <shared-error-message v-else-if="fetchError" :error="fetchError" />

    <template v-else-if="form">
      <UiPanel size="sm" variant="surface">
        <template #header>Quick Capture</template>
        <div class="flex items-center justify-between gap-4">
          <div>
            <ui-paragraph size="sm"
              >Enable the floating translate button</ui-paragraph
            >
            <ui-paragraph size="xs" color="content-secondary">
              Shows a language button in the corner of every page
            </ui-paragraph>
          </div>
          <ui-switch v-model="form.enabled" aria-label="Enable floating translate button" />
        </div>
      </UiPanel>

      <UiPanel size="sm" variant="surface">
        <template #header>Languages</template>
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-1.5">
            <UiLabel tag="label" for="language-target-language">Target language</UiLabel>
            <UiSelect
              id="language-target-language"
              v-model="form.targetLanguage"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
            <ui-paragraph size="xs" color="content-secondary">
              Language you are learning
            </ui-paragraph>
          </div>
          <div class="space-y-1.5">
            <UiLabel tag="label" for="language-native-language">Native language</UiLabel>
            <UiSelect
              id="language-native-language"
              v-model="form.nativeLanguage"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              class="w-full"
            />
            <ui-paragraph size="xs" color="content-secondary">
              Used for translations
            </ui-paragraph>
          </div>
        </div>
      </UiPanel>

      <UiPanel size="sm" variant="surface">
        <template #header>Review</template>
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <ui-paragraph size="sm">Auto-enroll new words</ui-paragraph>
              <ui-paragraph size="xs" color="content-secondary">
                Add generated stories to the review queue
              </ui-paragraph>
            </div>
            <ui-switch v-model="form.autoEnroll" aria-label="Auto-enroll new words" />
          </div>
          <div class="space-y-1.5">
            <UiLabel tag="label" for="language-session-card-limit">Cards per session</UiLabel>
            <ui-input
              id="language-session-card-limit"
              v-model.number="form.sessionCardLimit"
              type="number"
              min="5"
              max="50"
              class="w-32"
            />
          </div>
        </div>
      </UiPanel>

      <div class="flex justify-end">
        <ui-button :loading="isSaving" @click="handleSave">
          <Icon name="i-lucide-save" class="w-4 h-4 mr-1" />
          Save preferences
        </ui-button>
      </div>

      <shared-error-message v-if="saveError" :error="saveError" />
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  type SupportedLanguageCode,
} from "@shared/utils/language.contract";
import { useLanguageLearningRuntime } from "../composables/languageLearningRuntime";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";

const props = withDefaults(defineProps<{ compact?: boolean }>(), {
  compact: false,
});
const emit = defineEmits<{ (e: "saved"): void }>();

const { $api } = useNuxtApp();
const languageRuntime = useLanguageLearningRuntime();
const offline = useOfflineRuntime();

const fetchOp = useOperation<any>();
const saveOp = useOperation<any>();

const isLoading = fetchOp.pending;
const fetchError = fetchOp.error;
const isSaving = saveOp.pending;
const saveError = saveOp.error;

const compact = computed(() => props.compact);
const languageOptions = SUPPORTED_LANGUAGE_OPTIONS;

const form = ref<{
  enabled: boolean;
  targetLanguage: SupportedLanguageCode;
  nativeLanguage: SupportedLanguageCode;
  autoEnroll: boolean;
  sessionCardLimit: number;
} | null>(null);

const load = async () => {
  if (!offline.isOnline.value) {
    const result = await languageRuntime.ensurePreferences();
    if (result) {
      form.value = { enabled: result.enabled ?? true, targetLanguage: (result.targetLanguage ?? "en") as SupportedLanguageCode, nativeLanguage: (result.nativeLanguage ?? "en") as SupportedLanguageCode, autoEnroll: result.autoEnroll ?? true, sessionCardLimit: result.sessionCardLimit ?? 20 };
    }
    return;
  }
  const result = await fetchOp.execute(() => $api.language.getPreferences());
  if (result) {
    languageRuntime.setPreferences(result);
    form.value = {
      enabled: result.enabled ?? true,
      targetLanguage: (result.targetLanguage ?? "en") as SupportedLanguageCode,
      nativeLanguage:
        result.nativeLanguage === "auto"
          ? "en"
          : ((result.nativeLanguage ?? "en") as SupportedLanguageCode),
      autoEnroll: result.autoEnroll ?? true,
      sessionCardLimit: result.sessionCardLimit ?? 20,
    };
  }
};

const handleSave = async () => {
  if (!form.value) return;
  if (!offline.isOnline.value) {
    await offline.queue({ entity: "languagePreference", operation: "languagePreference.update", entityId: "languagePreference", changedFields: Object.keys(form.value), payload: form.value });
    languageRuntime.setPreferences({ ...(languageRuntime.preferences.value ?? {}), ...form.value } as any);
    languageRuntime.invalidateWords();
    emit("saved");
    return;
  }
  const result = await saveOp.execute(() =>
    $api.language.updatePreferences(form.value!),
  );
  if (result) {
    languageRuntime.setPreferences(result);
    languageRuntime.invalidateWords();
    emit("saved");
  }
};

onMounted(() => load());
</script>
