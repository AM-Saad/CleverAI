<!-- design-allow-file: quick word capture uses one native input so the compact
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
        <UiIcon name="i-lucide-bookmark-plus" class="h-3.5 w-3.5" />
        Capture word
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

    <form class="qwt__capture" @submit.prevent="capture">
      <div class="qwt__form">
        <input
          ref="inputEl"
          v-model="wordInput"
          class="qwt__input"
          dir="auto"
          placeholder="Type a word or phrase"
          aria-label="Word or phrase to capture"
          enterkeyhint="done"
        />
        <!-- design-allow: native quick-capture input -->
        <UiButton
          square
          tone="primary"
          :loading="isCapturing"
          :disabled="!wordInput.trim() || isBusy"
          aria-label="Capture word"
          type="submit"
        >
          <UiIcon name="i-lucide-bookmark-plus" class="h-4 w-4" />
        </UiButton>
      </div>
      <UiCheckbox
        v-model="translateCapturedWord"
        :label="`Translate into ${translationLanguageLabel}`"
        description="The word is always saved to your word bank"
        :disabled="isBusy"
      />
    </form>

    <div v-if="state === 'loading'" class="qwt__loading">
      <UiIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin" />
      Capturing…
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
        <span
          >{{ captureResult.detectedLang }} → {{ translationLanguage }}</span
        >
        <p dir="auto">{{ captureResult.translation }}</p>
      </div>

      <p v-if="captureResult.meanings?.[0]?.definition" class="qwt__definition">
        {{ captureResult.meanings[0].definition }}
      </p>
      <div class="qwt__saved">
        <UiIcon name="i-lucide-check-circle-2" class="h-4 w-4" />
        Saved to your word bank
      </div>

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
        v-if="captureResult"
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { getLanguageLabel } from "@shared/utils/language.contract";
import { useLanguageCapture } from "~/features/language-learning/composables/useLanguageCapture";

const emit = defineEmits<{
  (e: "back"): void;
  (e: "done"): void;
}>();
const { isMobile } = useResponsive();

const {
  state,
  captureResult,
  storyResult,
  preferences,
  isCapturing,
  captureError,
  isGeneratingStory,
  storyError,
  captureWord,
  generateStory,
  saveCapture,
  dismissResult,
  loadPreferences,
} = useLanguageCapture();

const inputEl = ref<HTMLInputElement | null>(null);
const wordInput = ref("");
const translateCapturedWord = ref(true);

const isBusy = computed(
  () =>
    state.value === "loading" ||
    state.value === "saving" ||
    state.value === "story-loading",
);
const translationLanguage = computed(
  () => preferences.value?.nativeLanguage ?? "en",
);
const translationLanguageLabel = computed(() =>
  getLanguageLabel(translationLanguage.value),
);
const stateLabel = computed(() => {
  if (state.value === "loading") return "Capturing";
  if (state.value === "saving") return "Saving";
  if (state.value === "story-loading") return "Story";
  if (state.value === "story-ready") return "Ready";
  return "Result";
});

async function capture() {
  const word = wordInput.value.trim();
  if (!word || isBusy.value) return;
  await captureWord(word, {
    includeTranslation: translateCapturedWord.value,
    translateOnly: false,
    sourceLang: preferences.value?.targetLanguage ?? "auto",
    sourceType: "manual",
  });
}

async function generateWordStory() {
  if (isBusy.value) return;
  let wordId = captureResult.value?.wordId;
  if (!wordId) {
    const saved = await saveCapture();
    wordId = saved?.wordId;
  }
  if (wordId) await generateStory(wordId);
}

watch(
  () => preferences.value?.translateOnCapture,
  (value) => {
    if (typeof value === "boolean") translateCapturedWord.value = value;
  },
  { immediate: true },
);

function reset() {
  dismissResult();
  wordInput.value = "";
  if (!isMobile.value) nextTick(() => inputEl.value?.focus());
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
  if (!isMobile.value) nextTick(() => inputEl.value?.focus());
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
.qwt__capture {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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
  border: 1px solid
    color-mix(in srgb, var(--color-accent-teal) 28%, var(--color-secondary));
  border-radius: var(--radius-xl);
  background: color-mix(
    in srgb,
    var(--color-accent-teal) 8%,
    var(--color-surface)
  );
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
.qwt__saved {
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
