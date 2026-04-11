<template>
  <shared-page-wrapper title="Language Settings" subtitle="Configure your language learning preferences">
    <div class="mt-6 max-w-lg space-y-6">
      <ui-loader v-if="isLoading" :is-fetching="true" />
      <shared-error-message v-else-if="fetchError" :error="fetchError" />

      <template v-else-if="form">
        <!-- Enable / disable -->
        <ui-card size="sm">
          <template #header>Quick Capture</template>
          <div class="flex items-center justify-between">
            <div>
              <ui-paragraph size="sm">Enable the floating translate button</ui-paragraph>
              <ui-paragraph size="xs" color="content-secondary">Shows a language button in the corner of every
                page</ui-paragraph>
            </div>
            <u-toggle v-model="form.enabled" />
          </div>
        </ui-card>

        <!-- Languages -->
        <ui-card size="sm">
          <template #header>Languages</template>
          <div class="space-y-4">
            <div class="space-y-1.5">
              <UiLabel tag="label">Target language (learning)</UiLabel>
              <u-input v-model="form.targetLanguage" placeholder="e.g. en, fr, es" class="w-full" />
              <ui-paragraph size="xs" color="content-secondary">ISO 639-1 code of the language you're
                learning</ui-paragraph>
            </div>
            <div class="space-y-1.5">
              <UiLabel tag="label">Native language</UiLabel>
              <u-input v-model="form.nativeLanguage" placeholder="e.g. ar, de, zh" class="w-full" />
              <ui-paragraph size="xs" color="content-secondary">Your native language (used for
                translations)</ui-paragraph>
            </div>
          </div>
        </ui-card>

        <!-- Review settings -->
        <ui-card size="sm">
          <template #header>Review</template>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <ui-paragraph size="sm">Auto-enroll new words</ui-paragraph>
                <ui-paragraph size="xs" color="content-secondary">Automatically add captured words to the review
                  queue</ui-paragraph>
              </div>
              <u-toggle v-model="form.autoEnroll" />
            </div>
            <div class="space-y-1.5">
              <UiLabel tag="label">Cards per session</UiLabel>
              <u-input v-model.number="form.sessionCardLimit" type="number" min="5" max="50" class="w-32" />
            </div>
          </div>
        </ui-card>

        <!-- Save -->
        <div class="flex justify-end">
          <u-button :loading="isSaving" @click="handleSave">
            <Icon name="i-lucide-save" class="w-4 h-4 mr-1" />
            Save preferences
          </u-button>
        </div>

        <shared-error-message v-if="saveError" :error="saveError" />
      </template>
    </div>
  </shared-page-wrapper>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "auth" });

const { $api } = useNuxtApp();

const fetchOp = useOperation<any>();
const saveOp = useOperation<any>();

const isLoading = fetchOp.pending;
const fetchError = fetchOp.error;
const isSaving = saveOp.pending;
const saveError = saveOp.error;

const form = ref<{
  enabled: boolean;
  targetLanguage: string;
  nativeLanguage: string;
  autoEnroll: boolean;
  sessionCardLimit: number;
} | null>(null);

const load = async () => {
  const result = await fetchOp.execute(() => $api.language.getPreferences());
  if (result) {
    const p = result as any;
    form.value = {
      enabled: p.enabled ?? true,
      targetLanguage: p.targetLanguage ?? "en",
      nativeLanguage: p.nativeLanguage ?? "ar",
      autoEnroll: p.autoEnroll ?? true,
      sessionCardLimit: p.sessionCardLimit ?? 20,
    };
  }
};

const handleSave = async () => {
  if (!form.value) return;
  await saveOp.execute(() => $api.language.updatePreferences(form.value!));
};

onMounted(() => load());
</script>
