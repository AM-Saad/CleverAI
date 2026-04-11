<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show"
        class="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50 backdrop-blur-sm p-4"
        @click.self="emit('decline')">
        <div
          class="relative w-full max-w-md rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)] bg-surface shadow-xl p-6 space-y-5">
          <!-- Icon -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon name="i-lucide-languages" class="w-5 h-5" />
            </div>
            <ui-subtitle size="lg" color="content-on-surface">Build your vocabulary</ui-subtitle>
          </div>

          <!-- Explanation -->
          <ui-paragraph size="sm">
            Save this word to your personal language deck. Cognilo will generate a short story to help you remember
            it,
            and schedule it for spaced repetition review — so it actually sticks.
          </ui-paragraph>

          <!-- Actions -->
          <div class="flex flex-col gap-2.5">
            <u-button size="md" class="w-full" @click="emit('confirm')">
              <Icon name="i-lucide-bookmark-plus" class="w-4 h-4 mr-1" />
              Add to Language Deck
            </u-button>
            <u-button variant="ghost" color="neutral" size="md" class="w-full" @click="emit('decline')">
              Just translate, don't save
            </u-button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "decline"): void;
}>();
</script>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
