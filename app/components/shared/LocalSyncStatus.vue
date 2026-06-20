<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    featureLabel: string;
    pendingCount?: number;
    pendingDetail?: string;
    errorCount?: number;
    isFetching?: boolean;
    isOnline?: boolean;
    isVerifiedOnline?: boolean;
    isConnecting?: boolean;
    lastSync?: Date | string | null;
    actionLabel?: string;
    actionDisabled?: boolean;
  }>(),
  {
    pendingCount: 0,
    pendingDetail: "",
    errorCount: 0,
    isFetching: false,
    isOnline: true,
    isVerifiedOnline: true,
    isConnecting: false,
    lastSync: null,
    actionLabel: "Sync now",
    actionDisabled: false,
  },
);

const emit = defineEmits<{ action: [] }>();

const status = computed(() => {
  if (props.errorCount > 0) return "error";
  if (props.isFetching || props.isConnecting) return "syncing";
  if (!props.isOnline || !props.isVerifiedOnline) return "offline";
  if (props.pendingCount > 0) return "pending";
  return "synced";
});

// Ephemeral confirmation: flash "Saved" only briefly after a sync settles, then
// fade back to a quiet dot so it never competes with the writing surface.
const justSaved = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | null = null;
watch(status, (next, prev) => {
  if (next === "synced" && prev && prev !== "synced") {
    justSaved.value = true;
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      justSaved.value = false;
    }, 1800);
  } else if (next !== "synced") {
    justSaved.value = false;
  }
});
onBeforeUnmount(() => {
  if (savedTimer) clearTimeout(savedTimer);
});

const pendingCopy = computed(
  () =>
    props.pendingDetail ||
    `${props.pendingCount} unsaved change${props.pendingCount === 1 ? "" : "s"}`,
);

const dotClass = computed(() => {
  switch (status.value) {
    case "syncing":
      return "bg-primary animate-pulse";
    case "offline":
      return "bg-warning";
    case "pending":
      return "bg-content-on-background/40";
    default:
      return justSaved.value ? "bg-success" : "bg-content-on-background/25";
  }
});

const ambientLabel = computed(() => {
  switch (status.value) {
    case "syncing":
      return "Saving…";
    case "offline":
      return "Offline";
    case "pending":
      return pendingCopy.value;
    default:
      return justSaved.value ? "Saved" : "";
  }
});

const errorLabel = computed(
  () =>
    `${props.errorCount} change${props.errorCount === 1 ? "" : "s"} failed to sync`,
);

function formatSyncTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const ambientTitle = computed(() => {
  if (status.value === "synced") {
    return props.lastSync
      ? `${props.featureLabel} synced · last saved ${formatSyncTime(props.lastSync)}`
      : `${props.featureLabel} synced`;
  }
  if (status.value === "offline") {
    return `${props.featureLabel} is offline — ${pendingCopy.value} stay local until you reconnect`;
  }
  if (status.value === "pending") return `${pendingCopy.value} waiting to sync`;
  return `Syncing ${props.featureLabel.toLowerCase()}`;
});
</script>

<template>
  <!-- Failed sync: the only state loud enough to interrupt, with a retry. -->
  <div
    v-if="status === 'error'"
    class="flex h-7 items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-error/30 px-2.5 text-error"
  >
    <div class="flex min-w-0 items-center gap-2">
      <Icon name="i-lucide-alert-triangle" class="h-3.5 w-3.5 shrink-0" />
      <p class="truncate text-xs leading-5">{{ errorLabel }}</p>
    </div>
    <UiButton
      size="xs"
      variant="ghost"
      color="error"
      class="shrink-0"
      :disabled="actionDisabled"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </UiButton>
  </div>

  <!-- Everything else: a quiet, right-aligned dot that stays out of the way. -->
  <div
    v-else
    class="flex h-6 items-center justify-end gap-1.5 px-2 text-content-secondary"
    :title="ambientTitle"
  >
    <span
      class="h-1.5 w-1.5 rounded-full transition-colors duration-500"
      :class="dotClass"
    />
    <Transition name="sync-fade">
      <span v-if="ambientLabel" class="text-xs">{{ ambientLabel }}</span>
    </Transition>
    <UiButton
      v-if="status === 'offline'"
      size="xs"
      variant="ghost"
      color="neutral"
      class="ml-1 shrink-0"
      :disabled="actionDisabled"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </UiButton>
  </div>
</template>

<style scoped>
.sync-fade-enter-active,
.sync-fade-leave-active {
  transition: opacity 0.3s ease;
}
.sync-fade-enter-from,
.sync-fade-leave-to {
  opacity: 0;
}
</style>
