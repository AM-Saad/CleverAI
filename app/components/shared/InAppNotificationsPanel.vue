<script setup lang="ts">
import type { NotificationItem } from "@@/shared/utils/notification.contract";

defineProps<{
  notifications: NotificationItem[];
  unreadCount: number;
  loading?: boolean;
}>();

defineEmits<{
  close: [];
  select: [notification: NotificationItem];
  markAllRead: [];
}>();

function formatTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
</script>

<template>
  <UiPanel
    tag="div"
    variant="surface"
    size="xs"
    class-name="fixed left-3 right-3 top-20 z-[var(--z-popover)] max-h-[calc(100dvh-6rem)] shadow-[var(--shadow-dropdown)] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-96 sm:max-w-[calc(100vw-2rem)]"
    content-class="p-0"
  >
    <template #header>
    <div class="flex items-center justify-between gap-3">
      <div>
        <ui-label weight="semibold">Notifications</ui-label>
        <ui-paragraph size="xs" color="content-secondary">
          {{ unreadCount }} unread
        </ui-paragraph>
      </div>
      <div class="flex items-center gap-1">
        <ui-button
          v-if="unreadCount > 0"
          variant="ghost"
          size="xs"
          icon="i-heroicons-check"
          @click="$emit('markAllRead')"
        >
          Mark all
        </ui-button>
        <ui-button
          variant="ghost"
          size="xs"
          square
          icon="i-heroicons-x-mark"
          aria-label="Close notifications"
          @click="$emit('close')"
        />
      </div>
    </div>
    </template>

    <div v-if="loading" class="px-4 py-8 text-center">
      <Icon
        name="i-heroicons-arrow-path"
        class="mx-auto h-6 w-6 animate-spin text-primary"
      />
      <ui-paragraph size="sm" color="content-secondary" class="mt-2">
        Loading notifications...
      </ui-paragraph>
    </div>

    <div v-else-if="notifications.length === 0" class="px-4 py-8 text-center">
      <Icon
        name="i-heroicons-bell-slash"
        class="mx-auto h-7 w-7 text-content-disabled"
      />
      <ui-paragraph size="sm" color="content-secondary" class="mt-2">
        No notifications yet.
      </ui-paragraph>
    </div>

    <div v-else class="max-h-[calc(100dvh-12rem)] overflow-y-auto sm:max-h-[26rem]">
      <UiButton
        v-for="notification in notifications"
        :key="notification.id"
        type="button"
        tone="neutral"
        variant="ghost"
        block
        class="!h-auto !justify-start rounded-none border-b border-secondary px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-subtle"
        @click="$emit('select', notification)"
      >
        <span
          class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          :class="notification.isRead ? 'bg-content-disabled' : 'bg-primary'"
        />
        <span class="min-w-0 flex-1">
          <span class="flex items-start justify-between gap-3">
            <ui-label class="line-clamp-2">
              {{ notification.title }}
            </ui-label>
            <ui-paragraph
              size="xs"
              color="content-secondary"
              class="shrink-0 whitespace-nowrap"
            >
              {{ formatTime(notification.sentAt) }}
            </ui-paragraph>
          </span>
          <ui-paragraph
            size="sm"
            color="content-secondary"
            class="mt-1 line-clamp-2"
          >
            {{ notification.content }}
          </ui-paragraph>
        </span>
      </UiButton>
    </div>
  </UiPanel>
</template>
