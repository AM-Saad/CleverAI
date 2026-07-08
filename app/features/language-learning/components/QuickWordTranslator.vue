<!-- design-allow-file: quick translator uses one native input so the compact
     shared-element capture field can keep exact IME/autofill/mobile keyboard
     behavior while matching the full language translator. -->
<template>
  <div class="qwt">
    <div class="qwt__bar">
      <UiIconButton
        icon="i-lucide-chevron-left"
        label="Back to capture"
        size="sm"
        :disabled="isBusy"
        @click="handleBack"
      />
      <span class="qwt__label">
        <UiIcon name="i-lucide-languages" class="h-3.5 w-3.5" />
        Translate word
      </span>
      <UiPill
        v-if="state !== 'idle'"
        size="sm"
        :label="stateLabel"
        color="var(--color-accent-teal)"
        variant="soft"
        max-width="120px"
      />
    </div>

    <form class="qwt__form" @submit.prevent="translate">
      <input
        ref="inputEl"
        v-model="wordInput"
        class="qwt__input"
        dir="auto"
        placeholder="Type a word or phrase"
        aria-label="Word or phrase to translate"
        enterkeyhint="go"
      />
      <!-- design-allow: native quick-translation input -->
      <UiButton
        square
        tone="primary"
        :loading="isCapturing"
        :disabled="!wordInput.trim() || isBusy"
        aria-label="Translate"
        type="submit"
      >
        <UiIcon name="i-lucide-arrow-right" class="h-4 w-4" />
      </UiButton>
    </form>

    <div v-if="state === 'loading'" class="qwt__loading">
      <UiIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin" />
      Translating…
    </div>

    <div v-else-if="captureResult" class="qwt__result">
      <div class="qwt__card">
        <div>
          <p class="qwt__word" dir="auto">{{ captureResult.word }}</p>
          <p v-if="captureResult.phonetic" class="qwt__phonetic">
            {{ captureResult.phonetic }}
          </p>
        </div>
        <UiPill
          v-if="captureResult.partOfSpeech"
          size="sm"
          :label="captureResult.partOfSpeech"
          color="var(--color-content-secondary)"
          variant="soft"
          max-width="120px"
        />
      </div>

      <div v-if="captureResult.translation" class="qwt__translation">
        <span>{{ captureResult.detectedLang }} → {{ translationLanguage }}</span>
        <p dir="auto">{{ captureResult.translation }}</p>
      </div>

      <p
        v-if="captureResult.meanings?.[0]?.definition"
        class="qwt__definition"
      >
        {{ captureResult.meanings[0].definition }}
      </p>

      <div v-if="state === 'story-ready' && storyResult" class="qwt__story">
        <UiIcon name="i-lucide-check-circle-2" class="h-4 w-4" />
        Story added to your language deck.
      </div>
    </div>

    <shared-error-message
      v-if="captureError || storyError"
      :error="captureError || storyError"
    />

    <div class="qwt__footer">
      <UiButton
        v-if="captureResult && !captureResult.saved"
        variant="ghost"
        tone="neutral"
        leading-icon="i-lucide-book-plus"
        :loading="isCapturing"
        :disabled="isBusy"
        @click="saveWord"
      >
        Save
      </UiButton>
      <UiButton
        v-else-if="captureResult"
        variant="ghost"
        tone="neutral"
        leading-icon="i-lucide-rotate-ccw"
        :disabled="isBusy"
        @click="reset"
      >
        Another
      </UiButton>
      <span v-else />

      <UiButton
        v-if="captureResult"
        variant="soft"
        tone="primary"
        leading-icon="i-lucide-sparkles"
        :loading="isGeneratingStory"
        :disabled="isBusy"
        @click="generateWordStory"
      >
        Story
      </UiButton>

      <UiButton pill tone="primary" :disabled="isBusy" @click="handleDone">
        Done
      </UiButton>
    </div>

    <ConsentSheet
      :show="showConsentSheet"
      @confirm="confirmCapture"
      @decline="declineCapture"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import ConsentSheet from "~/features/language-learning/components/ConsentSheet.vue";
import { useLanguageCapture } from "~/features/language-learning/composables/useLanguageCapture";

const emit = defineEmits<{
  (e: "back"): void;
  (e: "done"): void;
}>();

const {
  state,
  captureResult,
  storyResult,
  showConsentSheet,
  preferences,
  isCapturing,
  captureError,
  isGeneratingStory,
  storyError,
  captureWord,
  confirmCapture,
  declineCapture,
  generateStory,
  dismissResult,
  loadPreferences,
} = useLanguageCapture();

const inputEl = ref<HTMLInputElement | null>(null);
const wordInput = ref("");

const isBusy = computed(
  () => state.value === "loading" || state.value === "story-loading",
);
const translationLanguage = computed(
  () => preferences.value?.nativeLanguage ?? "en",
);
const stateLabel = computed(() => {
  if (state.value === "loading") return "Translating";
  if (state.value === "story-loading") return "Story";
  if (state.value === "story-ready") return "Ready";
  return "Result";
});

async function translate() {
  const word = wordInput.value.trim();
  if (!word || isBusy.value) return;
  await captureWord(word, {
    includeTranslation: true,
    translateOnly: true,
    sourceType: "manual",
  });
}

async function saveWord() {
  const word = captureResult.value?.word ?? wordInput.value.trim();
  if (!word || isBusy.value) return;
  await captureWord(word, {
    includeTranslation: true,
    translateOnly: false,
    sourceType: "manual",
  });
}

async function generateWordStory() {
  if (isBusy.value) return;
  let wordId = captureResult.value?.wordId;
  if (!wordId) {
    const saved = await captureWord(captureResult.value?.word ?? wordInput.value.trim(), {
      includeTranslation: true,
      translateOnly: false,
      sourceType: "manual",
    });
    wordId = saved?.wordId;
  }
  if (wordId) await generateStory(wordId);
}

function reset() {
  dismissResult();
  wordInput.value = "";
  nextTick(() => inputEl.value?.focus());
}

function clearAndEmit(eventName: "back" | "done") {
  dismissResult();
  wordInput.value = "";
  if (eventName === "back") emit("back");
  else emit("done");
}

function handleBack() {
  if (!isBusy.value) clearAndEmit("back");
}

function handleDone() {
  if (!isBusy.value) clearAndEmit("done");
}

onMounted(() => {
  void loadPreferences();
  nextTick(() => inputEl.value?.focus());
});
</script>

<style scoped>
.qwt {
  display: flex;
  min-height: 34dvh;
  flex-direction: column;
  gap: var(--space-3);
}
.qwt__bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: calc(-1 * var(--space-1));
}
.qwt__label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: var(--color-content-secondary);
  font-size: 12px;
  font-weight: 700;
}
.qwt__form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px;
  border: 1px solid var(--color-secondary);
  border-radius: var(--radius-full);
  background: var(--color-surface-strong);
}
.qwt__input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
  padding: 0 var(--space-2);
  color: var(--color-content-on-surface);
  font-size: 15px;
  outline: none;
}
.qwt__input::placeholder {
  color: var(--color-content-disabled);
}
.qwt__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 120px;
  color: var(--color-content-secondary);
  font-size: 14px;
  font-weight: 700;
}
.qwt__result {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.qwt__card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid color-mix(in srgb, var(--color-accent-teal) 28%, var(--color-secondary));
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--color-accent-teal) 8%, var(--color-surface));
}
.qwt__word {
  color: var(--color-content-on-surface-strong);
  font-size: 24px;
  font-weight: 800;
  line-height: 1.1;
}
.qwt__phonetic,
.qwt__definition {
  color: var(--color-content-secondary);
  font-size: 13px;
}
.qwt__translation {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-subtle);
}
.qwt__translation span {
  color: var(--color-content-disabled);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}
.qwt__translation p {
  margin-top: 2px;
  color: var(--color-primary);
  font-size: 18px;
  font-weight: 800;
}
.qwt__story {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-success);
  font-size: 13px;
  font-weight: 700;
}
.qwt__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-2);
}
</style>
