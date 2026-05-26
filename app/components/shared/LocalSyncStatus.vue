<script setup lang="ts">
const props = withDefaults(defineProps<{
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
}>(), {
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
});

const emit = defineEmits<{
  action: [];
}>();

const status = computed(() => {
  if (props.errorCount > 0) return "error";
  if (props.isFetching || props.isConnecting) return "syncing";
  if (!props.isOnline || !props.isVerifiedOnline) return "offline";
  if (props.pendingCount > 0) return "pending";
  return "synced";
});

const iconName = computed(() => {
  switch (status.value) {
    case "error":
      return "heroicons:exclamation-triangle";
    case "offline":
      return "heroicons:wifi";
    case "syncing":
      return "heroicons:arrow-path";
    case "pending":
      return "heroicons:clock";
    default:
      return "heroicons:check-circle";
  }
});

const toneClasses = computed(() => {
  switch (status.value) {
    case "error":
      return "border-error/20 text-error";
    case "offline":
      return "border-warning/20 text-warning";
    case "syncing":
      return "border-primary/20 text-primary";
    case "pending":
      return "border-primary/20 text-primary";
    default:
      return "border-success/20 text-success";
  }
});

const title = computed(() => {
  switch (status.value) {
    case "error":
      return `${props.featureLabel} needs attention`;
    case "offline":
      return `${props.featureLabel} is working offline`;
    case "syncing":
      return `Syncing ${props.featureLabel.toLowerCase()}`;
    case "pending":
      return `${props.featureLabel} has local changes`;
    default:
      return `${props.featureLabel} is synced`;
  }
});

const description = computed(() => {
  if (status.value === "error") {
    return `${props.errorCount} change${props.errorCount === 1 ? "" : "s"} failed to sync. Review or retry before moving on.`;
  }

  if (status.value === "offline") {
    const pendingCopy = props.pendingCount > 0
      ? `${props.pendingDetail || `${props.pendingCount} local change${props.pendingCount === 1 ? "" : "s"}`} will sync when the connection is verified.`
      : "Edits stay local until the connection is verified.";
    return props.isConnecting ? `Reconnecting now. ${pendingCopy}` : pendingCopy;
  }

  if (status.value === "syncing") {
    return props.pendingCount > 0
      ? `Sending ${props.pendingDetail || `${props.pendingCount} queued change${props.pendingCount === 1 ? "" : "s"}`} to the server.`
      : "Refreshing the latest server state.";
  }

  if (status.value === "pending") {
    return `${props.pendingDetail || `${props.pendingCount} local change${props.pendingCount === 1 ? "" : "s"}`} ${props.pendingCount === 1 ? "is" : "are"} waiting to sync.`;
  }

  if (!props.lastSync) {
    return "Ready for new changes.";
  }

  return `Last synced ${formatSyncTime(props.lastSync)}.`;
});

function formatSyncTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border px-3 h-10" :class="toneClasses">
    <div class="min-w-0 flex items-start justify-between gap-2">
      <Icon :name="iconName" class="mt-0.5 h-4 w-4 shrink-0" :class="{ 'animate-spin': status === 'syncing' }" />
      <div class="flex items-center gap-2 min-w-0">
        <p class="text-sm font-medium leading-5">
          {{ title }}
        </p>
        <p class="text-xs leading-5 opacity-90">
          {{ description }}
        </p>
      </div>
    </div>

    <UButton v-if="status !== 'synced'" size="xs" variant="ghost" color="neutral" class="shrink-0"
      :disabled="actionDisabled" @click="emit('action')">
      {{ actionLabel }}
    </UButton>
  </div>
</template>
