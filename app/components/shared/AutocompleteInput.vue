<template>
  <div ref="rootRef" class="relative w-full">
    <!-- Input wrapper — ghost text layer sits behind the real input -->
    <div class="relative">
      <!-- Ghost completion (text after cursor, visually dimmed) -->
      <div aria-hidden="true"
        class="pointer-events-none absolute inset-0 flex items-center px-3 text-sm overflow-hidden whitespace-pre select-none">
        <span class="invisible">{{ modelValue }}</span><!--
        --><span class="text-content-disabled">{{ ghostSuffix }}</span>
      </div>

      <!-- Real input -->
      <u-input ref="inputRef" :model-value="modelValue" v-bind="$attrs"
        :class="['w-full', ghostSuffix ? 'caret-primary' : '']" autocomplete="off" autocorrect="off" spellcheck="false"
        @update:model-value="handleInput" @keydown="handleKeydown" @focus="onFocus" @blur="onBlur" />
    </div>

    <!-- Dropdown suggestion list -->
    <Transition name="suggestions">
      <div v-if="showDropdown"
        class="absolute z-50 left-0 right-0 top-full mt-1 bg-surface border border-secondary rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto"
        role="listbox" :aria-label="dropdownLabel">
        <button v-for="(item, i) in suggestions" :key="item" type="button" role="option"
          :aria-selected="i === activeIndex" :class="[
            'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
            i === activeIndex
              ? 'bg-primary/10 text-primary'
              : 'text-content-on-surface hover:bg-surface-strong',
          ]" @mousedown.prevent="selectItem(item)">
          <span>{{ item }}</span>
          <kbd v-if="i === 0"
            class="shrink-0 hidden sm:inline-flex items-center gap-0.5 rounded border border-secondary px-1 py-0.5 text-[10px] font-mono text-content-secondary">Tab</kbd>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string;
  suggestions?: string[] | readonly string[];
  dropdownLabel?: string;
  /** Minimum chars before suggestions appear */
  minChars?: number;
}>(), {
  suggestions: () => [],
  dropdownLabel: 'Suggestions',
  minChars: 1,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  /** Fired every keystroke — host should update suggestions */
  (e: 'query', value: string): void;
  (e: 'accept', value: string): void;
}>();

const rootRef = ref<HTMLElement>();
const inputRef = ref<any>();
const activeIndex = ref(0);
const isFocused = ref(false);

// First suggestion shown as ghost inline completion
const ghostSuffix = computed(() => {
  if (!isFocused.value) return '';
  const val = props.modelValue;
  if (!val || val.length < props.minChars) return '';
  const first = props.suggestions[0];
  if (!first) return '';
  // Inline ghost: show the suffix of the first suggestion that extends the current word
  const words = val.split(' ');
  const currentWord = words[words.length - 1];
  if (!currentWord || !first.toLowerCase().startsWith(currentWord.toLowerCase())) return '';
  return first.slice(currentWord.length);
});

const showDropdown = computed(() =>
  isFocused.value &&
  props.modelValue.length >= props.minChars &&
  props.suggestions.length > 0
);

function handleInput(val: string) {
  activeIndex.value = 0;
  emit('update:modelValue', val);
  emit('query', val);
}

function handleKeydown(e: KeyboardEvent) {
  if (!showDropdown.value && !ghostSuffix.value) return;

  switch (e.key) {
    case 'Tab': {
      // Accept ghost / first suggestion
      e.preventDefault();
      if (ghostSuffix.value) {
        acceptGhost();
      } else if (props.suggestions[activeIndex.value]) {
        selectItem(props.suggestions[activeIndex.value]);
      }
      break;
    }
    case 'ArrowDown': {
      if (!showDropdown.value) break;
      e.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 1, props.suggestions.length - 1);
      break;
    }
    case 'ArrowUp': {
      if (!showDropdown.value) break;
      e.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 1, 0);
      break;
    }
    case 'Enter': {
      if (showDropdown.value && props.suggestions[activeIndex.value]) {
        e.preventDefault();
        selectItem(props.suggestions[activeIndex.value]);
      }
      break;
    }
    case 'Escape': {
      if (showDropdown.value) {
        e.preventDefault();
        emit('query', ''); // ask host to clear
      }
      break;
    }
  }
}

function acceptGhost() {
  const val = props.modelValue;
  const first = props.suggestions[0];
  if (!first) return;
  const words = val.split(' ');
  words[words.length - 1] = first;
  const accepted = words.join(' ');
  emit('update:modelValue', accepted);
  emit('accept', first);
  emit('query', accepted);
}

function selectItem(item: string) {
  // Replace the current partial word with the chosen suggestion
  const words = props.modelValue.split(' ');
  words[words.length - 1] = item;
  const accepted = words.join(' ') + ' ';
  emit('update:modelValue', accepted);
  emit('accept', item);
  emit('query', accepted);
  activeIndex.value = 0;
}

function onFocus() {
  isFocused.value = true;
}

function onBlur() {
  // Small delay so mousedown on dropdown fires before blur closes it
  setTimeout(() => { isFocused.value = false; }, 120);
}

// Reset active index when suggestions list changes
watch(() => props.suggestions, () => { activeIndex.value = 0; });
</script>

<style scoped>
.suggestions-enter-active,
.suggestions-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.suggestions-enter-from,
.suggestions-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
