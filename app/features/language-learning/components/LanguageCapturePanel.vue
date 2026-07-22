<template>
  <section class="language-capture" aria-labelledby="language-capture-title">
    <div class="language-capture__header">
      <div>
        <UiSubtitle id="language-capture-title" tag="h2" size="base"
          >Capture a word</UiSubtitle
        >
        <UiParagraph size="sm" color="content-secondary">
          Save new vocabulary now; translation is optional.
        </UiParagraph>
      </div>
      <span class="language-capture__icon" aria-hidden="true">
        <UiIcon name="i-lucide-bookmark-plus" class="h-5 w-5" />
      </span>
    </div>

    <form class="language-capture__form" @submit.prevent="$emit('submit')">
      <div class="language-capture__search">
        <UiInput
          v-model="word"
          :placeholder="inputPlaceholder"
          icon="i-lucide-bookmark-plus"
          class="language-capture__search-input"
          aria-label="Word or phrase to capture"
        />
        <span class="language-capture__direction">{{ directionLabel }}</span>
      </div>
      <div class="language-capture__options">
        <UiCheckbox
          v-model="translate"
          :label="`Translate into ${nativeLanguageLabel}`"
          description="Capture always adds the word to your word bank"
          :disabled="capturing"
        />
        <UiButton
          type="submit"
          leading-icon="i-lucide-bookmark-plus"
          :loading="capturing"
          :disabled="!word.trim()"
        >
          Capture word
        </UiButton>
      </div>
    </form>

    <div v-if="capturing" class="language-capture__loading">
      <AiShimmer :lines="2" />
    </div>

    <UiCard
      v-else-if="result"
      variant="default"
      shadow="none"
      class-name="language-capture__result"
    >
      <div class="language-capture__word-row">
        <UiTitle tag="h2" class="language-capture__word" dir="auto">{{
          result.word
        }}</UiTitle>
        <span
          v-if="result.partOfSpeech"
          class="language-capture__part-of-speech"
          >{{ result.partOfSpeech }}</span
        >
      </div>
      <div v-if="result.phonetic" class="language-capture__phonetic">
        {{ result.phonetic }}
        <UiIconButton
          icon="i-lucide-volume-2"
          label="Play pronunciation"
          size="xs"
          @click="$emit('speak', result.word)"
        />
      </div>

      <UiPanel
        v-if="result.translation"
        variant="subtle"
        size="sm"
        class-name="language-capture__translation"
      >
        <span class="language-capture__eyebrow">{{ translationLabel }}</span>
        <p class="language-capture__translation-text" dir="auto">
          {{ result.translation }}
        </p>
      </UiPanel>

      <div v-if="exampleText" class="language-capture__example">
        <span class="language-capture__eyebrow">EXAMPLE</span>
        <p
          class="language-capture__example-source"
          dir="auto"
          v-html="highlightedExampleHtml"
        />
        <p
          v-if="exampleTranslation"
          class="language-capture__example-translation"
          dir="auto"
        >
          {{ exampleTranslation }}
        </p>
      </div>

      <div class="language-capture__saved">
        <UiPill
          label="Saved to word bank"
          color="var(--color-success)"
          variant="soft"
          active
          max-width="180px"
        />
        <UiButton
          tone="neutral"
          variant="ghost"
          leading-icon="i-lucide-rotate-ccw"
          @click="$emit('reset')"
        >
          Capture another
        </UiButton>
      </div>
    </UiCard>

    <UiAlert
      v-else-if="error"
      tone="error"
      title="Couldn't capture word"
      :description="error"
    />
  </section>
</template>

<script setup lang="ts">
import type { CaptureWordResponse } from "@shared/utils/language.contract";
import type { DeepReadonly } from "vue";
import AiShimmer from "~/components/ui/AiShimmer.vue";

const word = defineModel<string>("word", { required: true });
const translate = defineModel<boolean>("translate", { required: true });
defineProps<{
  capturing: boolean;
  result: DeepReadonly<CaptureWordResponse> | null;
  error?: string | null;
  inputPlaceholder: string;
  directionLabel: string;
  nativeLanguageLabel: string;
  translationLabel: string;
  exampleText?: string;
  exampleTranslation?: string;
  highlightedExampleHtml?: string;
}>();
defineEmits<{ submit: []; reset: []; speak: [text: string] }>();
</script>

<style scoped>
.language-capture {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-secondary);
  border-radius: var(--component-card-radius);
  background: var(--ds-surface-card);
}
.language-capture__header,
.language-capture__options,
.language-capture__word-row,
.language-capture__phonetic,
.language-capture__saved {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.language-capture__header {
  justify-content: space-between;
}
.language-capture__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--component-card-radius);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}
.language-capture__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.language-capture__search {
  position: relative;
  display: flex;
  align-items: center;
}
.language-capture__search-input {
  width: 100%;
}
.language-capture__direction {
  position: absolute;
  right: var(--space-3);
  color: var(--color-content-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.language-capture__options {
  justify-content: space-between;
}
.language-capture__loading {
  padding: var(--space-4) 0;
}
.language-capture__word-row {
  align-items: baseline;
}
.language-capture__word {
  color: var(--color-content-on-surface-strong);
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.6px;
}
.language-capture__part-of-speech {
  padding: 2px var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-surface-subtle);
  color: var(--color-content-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
}
.language-capture__phonetic {
  margin-top: var(--space-1);
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
}
.language-capture__translation,
.language-capture__example {
  margin-top: var(--space-4);
}
.language-capture__eyebrow {
  color: var(--color-content-secondary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
}
.language-capture__translation-text {
  color: var(--color-content-on-surface-strong);
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.4px;
}
.language-capture__example-source {
  margin-top: 2px;
  color: var(--color-content-on-surface-strong);
  font-size: 15px;
  line-height: var(--leading-normal);
}
.language-capture__example-source :deep(.language-capture__highlight) {
  color: var(--color-primary);
  font-weight: 700;
}
.language-capture__example-translation {
  margin-top: 2px;
  color: var(--color-content-secondary);
  font-size: var(--text-sm);
}
.language-capture__saved {
  margin-top: var(--space-6);
}
@media (max-width: 639px) {
  .language-capture__options {
    align-items: stretch;
    flex-direction: column;
  }
  .language-capture__header {
    align-items: flex-start;
  }
}
</style>
