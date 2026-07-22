<template>
  <UiSheet :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div class="inbox__head">
        <h2 class="inbox__title">Notifications</h2>
        <button v-if="unreadCount > 0" type="button" class="inbox__mark" @click="markAllRead"> <!-- design-allow: native text action -->
          Mark all read
        </button>
      </div>
    </template>

    <div v-if="loading && !notifications.length" class="inbox__loading">
      <UiSkeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-[var(--radius-xl)]" />
    </div>

    <div v-else-if="!notifications.length" class="inbox__empty">
      <UiIcon name="i-lucide-bell-off" class="h-8 w-8 text-content-disabled" />
      <p>You're all caught up.</p>
    </div>

    <ul v-else class="inbox__list">
      <li v-for="n in notifications" :key="n.id">
        <button type="button" class="inbox__row" :class="{ 'inbox__row--unread': !n.isRead }" @click="select(n)"> <!-- design-allow: native notification row -->
          <span class="inbox__dot" :class="{ 'inbox__dot--on': !n.isRead }" />
          <span class="inbox__row-main">
            <span class="inbox__row-title">{{ n.title }}</span>
            <span class="inbox__row-body">{{ n.content }}</span>
            <span class="inbox__row-time">{{ relativeTime(n.sentAt) }}</span>
          </span>
        </button>
      </li>
    </ul>
  </UiSheet>
</template>

<script setup lang="ts">
/**
 * NotificationsInboxSheet — the in-app notification inbox (recent + unread +
 * mark-read), re-homed from the old header bell into a bottom sheet. Tapping an
 * item marks it read and deep-links if it carries a URL.
 */
import { onMounted } from "vue";
import type { NotificationItem } from "@@/shared/utils/notification.contract";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "update:open", v: boolean): void }>();

const { notifications, unreadCount, loading, refresh, markRead, markAllRead } = useInAppNotifications();

async function select(n: NotificationItem) {
  if (!n.isRead) await markRead(n.id);
  emit("update:open", false);
  if (n.url) await navigateTo(n.url);
}

function relativeTime(value: Date | string) {
  const diff = Date.now() - new Date(value).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

onMounted(() => refresh());
</script>

<style scoped>
.inbox__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.inbox__title {
  font-size: 19px;
  font-weight: 800;
  letter-spacing: -0.3px;
  color: var(--color-content-on-surface-strong);
}
.inbox__mark {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}
.inbox__loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}
.inbox__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  color: var(--color-content-secondary);
}
.inbox__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
  padding: 0;
  margin: 0;
}
.inbox__row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  border-radius: var(--radius-xl);
  text-align: left;
}
.inbox__row--unread {
  background: var(--color-primary-soft);
}
.inbox__row:active {
  background: var(--color-surface-subtle);
}
.inbox__dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: var(--radius-full);
  background: transparent;
  flex-shrink: 0;
}
.inbox__dot--on {
  background: var(--color-primary);
}
.inbox__row-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.inbox__row-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.2px;
  color: var(--color-content-on-surface-strong);
}
.inbox__row-body {
  font-size: 13px;
  line-height: 1.45;
  color: var(--color-content-secondary);
}
.inbox__row-time {
  font-size: 11px;
  color: var(--color-content-disabled);
  margin-top: 2px;
}
</style>
