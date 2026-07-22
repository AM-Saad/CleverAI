<template>
  <AccountPageFrame
    title="Language"
    subtitle="Quick capture, translation, and session defaults."
  >
    <UiSettingsGroup title="Language preferences">
      <template v-if="languageLoading">
        <UiSettingsRow
          title="Loading language preferences"
          description="One moment..."
        />
      </template>
      <template v-else-if="languageForm">
        <UiSettingsRow
          title="Quick capture"
          description="Show the Word action in global capture"
        >
          <template #leading>
            <UiIcon name="i-lucide-languages" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSwitch v-model="languageForm.enabled" />
          </template>
        </UiSettingsRow>
        <UiSettingsRow
          title="Target language"
          description="Language you are learning"
        >
          <template #leading>
            <UiIcon name="i-lucide-book-open-text" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSelect
              v-model="languageForm.targetLanguage"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              size="sm"
              class="account-language__select"
              aria-label="Target language"
            />
          </template>
        </UiSettingsRow>
        <UiSettingsRow
          title="Native language"
          description="Used for translations"
        >
          <template #leading>
            <UiIcon name="i-lucide-message-circle" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSelect
              v-model="languageForm.nativeLanguage"
              :items="languageOptions"
              value-key="value"
              label-key="label"
              size="sm"
              class="account-language__select"
              aria-label="Native language"
            />
          </template>
        </UiSettingsRow>
        <UiSettingsRow
          title="Translate captured words"
          description="Default the capture translation checkbox to on"
        >
          <template #leading>
            <UiIcon name="i-lucide-languages" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSwitch v-model="languageForm.translateOnCapture" />
          </template>
        </UiSettingsRow>
        <UiSettingsRow
          title="Auto-enroll new words"
          description="Add newly saved words to the review queue"
        >
          <template #leading>
            <UiIcon name="i-lucide-book-plus" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSwitch v-model="languageForm.autoEnroll" />
          </template>
        </UiSettingsRow>
        <UiSettingsRow
          title="Cards per language session"
          :description="`${languageForm.sessionCardLimit} cards per session`"
        >
          <template #leading>
            <UiIcon name="i-lucide-rectangle-stack" class="h-4 w-4" />
          </template>
          <template #control>
            <UiSettingsStepper
              v-model="languageForm.sessionCardLimit"
              :min="5"
              :max="50"
            />
          </template>
        </UiSettingsRow>
      </template>
      <UiSettingsRow
        v-else
        title="Language preferences unavailable"
        description="We could not load the current language settings."
      >
        <template #control>
          <UiButton
            size="xs"
            variant="soft"
            :loading="languageLoading"
            @click="loadLanguagePreferences"
          >
            Retry
          </UiButton>
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <shared-error-message
      v-if="languageError"
      :error="languageError"
      :refresh="loadLanguagePreferences"
    />
    <UiButton
      block
      size="lg"
      :loading="languageSaving"
      :disabled="!languageForm"
      @click="saveLanguagePreferences"
    >
      Save language preferences
    </UiButton>
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { APIError } from "~/services/FetchFactory";
import type {
  SupportedLanguageCode,
  UserLanguagePreferences,
} from "@shared/utils/language.contract";
import { SUPPORTED_LANGUAGE_OPTIONS } from "@shared/utils/language.contract";
import { useLanguageLearningRuntime } from "~/features/language-learning/composables/languageLearningRuntime";

definePageMeta({ middleware: "auth" });

const toast = useToast();
const languageRuntime = useLanguageLearningRuntime();
const languageOptions = SUPPORTED_LANGUAGE_OPTIONS;
const languageForm = ref<{
  enabled: boolean;
  targetLanguage: SupportedLanguageCode;
  nativeLanguage: SupportedLanguageCode;
  translateOnCapture: boolean;
  autoEnroll: boolean;
  sessionCardLimit: number;
} | null>(null);
const languageLoading = ref(false);
const languageSaving = ref(false);
const languageError = ref<APIError | string | null>(null);

async function loadLanguagePreferences() {
  languageLoading.value = true;
  languageError.value = null;
  try {
    const result = await languageRuntime.ensurePreferences();
    if (!result) {
      languageError.value =
        languageRuntime.preferencesError.value ??
        "Language preferences are not available offline yet.";
      return;
    }
    setLanguageForm(result);
  } finally {
    languageLoading.value = false;
  }
}

function setLanguageForm(result: UserLanguagePreferences) {
  languageForm.value = {
    enabled: result.enabled ?? true,
    targetLanguage: (result.targetLanguage ?? "en") as SupportedLanguageCode,
    nativeLanguage: (result.nativeLanguage ?? "en") as SupportedLanguageCode,
    translateOnCapture: result.translateOnCapture ?? true,
    autoEnroll: result.autoEnroll ?? true,
    sessionCardLimit: result.sessionCardLimit ?? 20,
  };
}

async function saveLanguagePreferences() {
  if (!languageForm.value) return;
  languageSaving.value = true;
  languageError.value = null;
  try {
    const result = await languageRuntime.updatePreferences(languageForm.value);
    if (result) {
      setLanguageForm(result);
      toast.add({ title: "Language preferences saved", color: "success" });
    } else {
      languageError.value =
        languageRuntime.preferencesError.value ??
        "Could not save language preferences.";
      toast.add({
        title: "Could not save language",
        description:
          languageRuntime.preferencesError.value?.message ??
          "Try again when you are online.",
        color: "error",
      });
    }
  } finally {
    languageSaving.value = false;
  }
}

onMounted(loadLanguagePreferences);
</script>

<style scoped>
.account-language__select {
  width: 9rem;
}
</style>
