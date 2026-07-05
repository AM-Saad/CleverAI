<template>
  <div
    ref="readerEl"
    class="story"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    tabindex="-1"
    @keydown="onKeydown"
  >
    <!-- reader header -->
    <header class="story__header">
      <UiIconButton
        icon="i-lucide-chevron-left"
        label="Back"
        @click="emit('close')"
      />
      <div class="story__heading">
        <p class="story__title" dir="auto">{{ title }}</p>
        <p class="story__meta">
          Story · {{ level }} · {{ savedWords.length }} saved words
        </p>
      </div>
      <span class="story__aa">Aa</span>
    </header>

    <!-- body with highlighted saved words -->
    <div class="story__body" @click="closePopover">
      <p class="story__text" dir="auto">
        <template v-for="(seg, i) in segments" :key="i">
          <span
            v-if="seg.saved"
            class="story__word"
            :class="{ 'story__word--active': active === i }"
            :style="{ '--hl': seg.accent }"
            @click.stop="openPopover(i)"
          >
            {{ seg.text }}
            <span v-if="active === i" class="story__pop">
              <span class="story__pop-word">{{ seg.text }}</span>
              <span class="story__pop-tr"
                >{{ seg.translation
                }}<template v-if="seg.phonetic">
                  · {{ seg.phonetic }}</template
                ></span
              >
              <span class="story__pop-actions">
                <button
                  type="button"
                  class="story__pop-btn story__pop-btn--save"
                  @click.stop="emit('save', seg.text)"
                >
                  <!-- design-allow: popover action -->
                  ＋ Save
                </button>
                <button
                  type="button"
                  class="story__pop-btn"
                  @click.stop="speak(seg.text)"
                >
                  <!-- design-allow: popover action -->
                  ◉ Hear
                </button>
              </span>
              <span class="story__pop-caret" />
            </span>
          </span>
          <template v-else>{{ seg.text }}</template>
        </template>
      </p>
    </div>

    <!-- read-aloud bar -->
    <div class="story__aloud">
      <button
        type="button"
        class="story__play"
        :aria-label="playing ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <!-- design-allow: native audio control -->
        <UiIcon
          :name="playing ? 'i-lucide-pause' : 'i-lucide-play'"
          class="h-4 w-4"
        />
      </button>
      <div class="story__aloud-main">
        <div class="story__track">
          <span class="story__track-fill" :style="{ width: progress + '%' }" />
        </div>
        <div class="story__aloud-meta">
          <span>Read aloud · {{ rate }}×</span>
          <span>{{ duration }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * StoryReader — the immersive module-04 story screen. Warm paper background,
 * saved words highlighted in their stable accent tint, a dark inline popover on
 * tap (translation + phonetic + Save/Hear), and a dark read-aloud bar with a
 * brand-tinted progress track.
 */
import { ref, computed } from "vue";
import { accentVarFor } from "~/composables/useAccentColor";

interface SavedWord {
  word: string;
  translation: string;
  phonetic?: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    level?: string;
    text: string;
    savedWords?: SavedWord[];
  }>(),
  { level: "A2", savedWords: () => [] },
);

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", word: string): void;
}>();

const readerEl = ref<HTMLElement | null>(null);
const { onKeydown } = useFocusTrap(
  computed(() => true),
  readerEl,
  {
    onEscape: () => emit("close"),
  },
);
const active = ref<number | null>(null);
const playing = ref(false);
const progress = ref(0);
const rate = 0.9;
const duration = "1:12";

// Split the story into segments, marking saved words so they can be highlighted
// and made tappable. Each saved word keeps its stable accent.
const segments = computed(() => {
  const saved = props.savedWords;
  if (!saved.length) return [{ text: props.text, saved: false }];
  const escaped = saved.map((w) =>
    w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const re = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  const out: Array<{
    text: string;
    saved: boolean;
    translation?: string;
    phonetic?: string;
    accent?: string;
  }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(props.text)) !== null) {
    if (m.index > last)
      out.push({ text: props.text.slice(last, m.index), saved: false });
    const hit = saved.find((w) => w.word.toLowerCase() === m![0].toLowerCase());
    out.push({
      text: m[0],
      saved: true,
      translation: hit?.translation ?? "",
      phonetic: hit?.phonetic,
      accent: accentVarFor(m[0].toLowerCase()),
    });
    last = m.index + m[0].length;
  }
  if (last < props.text.length)
    out.push({ text: props.text.slice(last), saved: false });
  return out;
});

function openPopover(i: number) {
  active.value = active.value === i ? null : i;
}
function closePopover() {
  active.value = null;
}
function speak(text: string) {
  if (import.meta.client && "speechSynthesis" in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    window.speechSynthesis.speak(u);
  }
}
function togglePlay() {
  if (!import.meta.client || !("speechSynthesis" in window)) return;
  if (playing.value) {
    window.speechSynthesis.cancel();
    playing.value = false;
    return;
  }
  const u = new SpeechSynthesisUtterance(props.text);
  u.rate = rate;
  u.onend = () => {
    playing.value = false;
    progress.value = 100;
  };
  window.speechSynthesis.speak(u);
  playing.value = true;
}
</script>

<style scoped>
.story {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: var(--color-background);
}
.dark .story {
  background: var(--color-surface);
}
.story__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-3);
}
.story__aa {
  color: var(--color-content-on-surface);
}
.story__heading {
  text-align: center;
}
.story__title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-content-on-surface-strong);
}
.story__meta {
  font-size: 11px;
  color: var(--color-content-secondary);
}
.story__aa {
  font-size: 15px;
  font-weight: 600;
}
.story__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 22px;
}
.story__text {
  font-size: 17px;
  line-height: 2;
  color: var(--color-content-on-surface-strong);
}
.dark .story__text {
  color: var(--color-content-on-surface);
}
.story__word {
  position: relative;
  border-radius: var(--radius-md);
  padding: 1px 3px;
  cursor: pointer;
  background: color-mix(in srgb, var(--hl) 20%, transparent);
}
.story__word--active {
  box-shadow: inset 0 -2px 0 var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 16%, transparent);
}
.story__pop {
  position: absolute;
  left: 50%;
  bottom: 140%;
  transform: translateX(-50%);
  width: 160px;
  display: block;
  background: var(--color-dark);
  border-radius: var(--radius-2xl);
  padding: 11px 13px;
  box-shadow: 0 10px 30px color-mix(in srgb, black 35%, transparent);
  z-index: var(--z-popover);
  cursor: default;
}
.story__pop-word {
  display: block;
  font-weight: 700;
  font-size: 14px;
  color: var(--color-white);
}
.story__pop-tr {
  display: block;
  font-size: 12px;
  color: var(--color-accent-indigo);
  margin: 2px 0 7px;
}
.story__pop-actions {
  display: flex;
  gap: 6px;
}
.story__pop-btn {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-full);
  padding: 5px;
  color: var(--color-white);
  background: color-mix(in srgb, var(--color-white) 16%, transparent);
}
.story__pop-btn--save {
  color: var(--color-content-on-surface-strong);
  background: var(--color-white);
}
.story__pop-caret {
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-dark);
}
.story__aloud {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 0 16px calc(20px + env(safe-area-inset-bottom));
  background: var(--color-dark);
  border-radius: 16px;
  padding: 13px 16px;
  box-shadow: var(--shadow-card-hover);
}
.story__play {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-full);
  background: var(--color-white);
  color: var(--color-content-on-surface-strong);
  flex-shrink: 0;
}
.story__aloud-main {
  flex: 1;
}
.story__track {
  height: 4px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-white) 18%, transparent);
  overflow: hidden;
}
.story__track-fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  /* 2-stop cyan→pink (NOT the reserved 3-stop reward brand gradient). */
  background: linear-gradient(
    90deg,
    var(--color-accent-cyan),
    var(--color-accent-pink)
  );
}
.story__aloud-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: color-mix(in srgb, var(--color-white) 62%, transparent);
}
</style>
