<template>
  <AccountPageFrame
    title="Reminders"
    :subtitle="
      isDaily
        ? 'Browser delivery and shared notification settings.'
        : 'Browser delivery and study notification timing.'
    "
  >
    <template #action>
      <UiButton
        size="xs"
        variant="ghost"
        tone="neutral"
        square
        aria-label="Open notification inbox"
        @click="inboxOpen = true"
      >
        <UiIcon name="i-lucide-inbox" class="h-4 w-4" />
      </UiButton>
      <UiPill
        v-if="unreadCount > 0"
        size="sm"
        :label="String(unreadCount)"
        color="var(--color-primary)"
        variant="fill"
        max-width="60px"
      />
    </template>

    <UiSettingsGroup title="Browser delivery">
      <UiSettingsRow
        title="Browser delivery"
        :description="currentDeviceStatusHint"
        :trailing-text="currentDeviceStatusLabel"
      >
        <template #leading>
          <UiIcon name="i-lucide-smartphone" class="h-4 w-4" />
        </template>
        <template #control>
          <div class="account-notifications__inline-actions">
            <UiButton
              v-if="!currentDeviceConnected"
              size="xs"
              variant="soft"
              :loading="subscriptionLoading"
              @click="enableCurrentDevice"
            >
              {{ needsDeviceRepair ? "Reconnect" : "Enable" }}
            </UiButton>
            <UiButton
              v-else
              size="xs"
              variant="ghost"
              tone="neutral"
              :loading="subscriptionLoading"
              @click="disableCurrentDevice"
            >
              Disable
            </UiButton>
            <UiButton
              size="xs"
              variant="ghost"
              tone="neutral"
              :loading="subscriptionsLoading"
              square
              aria-label="Refresh notification devices"
              @click="loadDeviceDeliveryState"
            >
              <UiIcon name="i-lucide-rotate-cw" class="h-4 w-4" />
            </UiButton>
          </div>
        </template>
      </UiSettingsRow>

      <UiSettingsRow title="Saved devices" :description="savedDeviceSummary">
        <template #leading>
          <UiIcon name="i-lucide-monitor-smartphone" class="h-4 w-4" />
        </template>
        <template #default>
          <div
            v-if="savedSubscriptions.length"
            class="account-notifications__devices"
          >
            <div
              v-for="subscription in savedSubscriptions"
              :key="subscription.id"
              class="account-notifications__device"
            >
              <div class="account-notifications__device-main">
                <span class="account-notifications__device-name">
                  {{ formatUserAgent(subscription.userAgent) }}
                </span>
                <span class="account-notifications__device-meta">
                  Last connected
                  {{
                    formatShortDate(
                      subscription.lastSeen || subscription.createdAt,
                    )
                  }}
                </span>
              </div>
              <UiPill
                v-if="subscription.isCurrentDevice"
                size="sm"
                label="This device"
                color="var(--color-success)"
                variant="outline"
                active
                max-width="100px"
              />
              <UiPill
                v-else-if="!subscription.isActive"
                size="sm"
                label="Inactive"
                color="var(--color-warning)"
                variant="outline"
                active
                max-width="86px"
              />
              <UiDoubleTapDeleteButton
                hide-label
                icon="i-lucide-trash-2"
                label="Remove saved notification device"
                armed-label="Tap again to remove device"
                size="xs"
                variant="ghost"
                :loading="removingSubscriptionId === subscription.id"
                :disabled="
                  Boolean(
                    removingSubscriptionId &&
                    removingSubscriptionId !== subscription.id,
                  )
                "
                :reset-key="subscription.id"
                @confirm="
                  removeSavedSubscription(
                    subscription.id,
                    subscription.isCurrentDevice,
                  )
                "
              />
            </div>
          </div>
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <UiSettingsGroup v-if="!isDaily" title="Study reminders">
      <UiSettingsRow
        v-if="notificationLoading"
        title="Loading reminder preferences"
        description="One moment..."
      />
      <UiSettingsRow
        title="Cards due"
        :description="`Daily reminder time ${notificationPrefs.cardDueTime}`"
      >
        <template #leading>
          <UiIcon name="i-lucide-layers-3" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSwitch v-model="notificationPrefs.cardDueEnabled" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Notify threshold"
        :description="`Notify when ${notificationPrefs.cardDueThreshold}+ cards are due`"
      >
        <template #leading>
          <UiIcon name="i-lucide-bell-ring" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSettingsStepper
            v-model="notificationPrefs.cardDueThreshold"
            :min="1"
            :max="100"
          />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Card due time"
        description="When the daily reminder fires"
      >
        <template #leading>
          <UiIcon name="i-lucide-clock" class="h-4 w-4" />
        </template>
        <template #control>
          <UiInput
            v-model="notificationPrefs.cardDueTime"
            type="time"
            class="account-notifications__time"
          />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Daily study reminder"
        description="A separate daily nudge to study"
      >
        <template #leading>
          <UiIcon name="i-lucide-calendar-clock" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSwitch v-model="notificationPrefs.dailyReminderEnabled" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        v-if="notificationPrefs.dailyReminderEnabled"
        title="Daily reminder time"
        description="When the study reminder fires"
      >
        <template #control>
          <UiInput
            v-model="notificationPrefs.dailyReminderTime"
            type="time"
            class="account-notifications__time"
          />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <UiSettingsGroup title="Delivery window">
      <UiSettingsRow
        title="Quiet hours"
        :description="`${notificationPrefs.quietHoursStart}-${notificationPrefs.quietHoursEnd}`"
      >
        <template #leading>
          <UiIcon name="i-lucide-moon" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSwitch v-model="notificationPrefs.quietHoursEnabled" />
        </template>
      </UiSettingsRow>
      <template v-if="notificationPrefs.quietHoursEnabled">
        <UiSettingsRow title="Quiet hours start">
          <template #control>
            <UiInput
              v-model="notificationPrefs.quietHoursStart"
              type="time"
              class="account-notifications__time"
            />
          </template>
        </UiSettingsRow>
        <UiSettingsRow title="Quiet hours end">
          <template #control>
            <UiInput
              v-model="notificationPrefs.quietHoursEnd"
              type="time"
              class="account-notifications__time"
            />
          </template>
        </UiSettingsRow>
      </template>
      <UiSettingsRow
        title="Send anytime"
        description="Allow reminders any time outside quiet hours"
      >
        <template #leading>
          <UiIcon name="i-lucide-send" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSwitch v-model="notificationPrefs.sendAnytimeOutsideQuietHours" />
        </template>
      </UiSettingsRow>
      <UiSettingsRow
        title="Active hours"
        :description="`${notificationPrefs.activeHoursStart}-${notificationPrefs.activeHoursEnd}`"
      >
        <template #leading>
          <UiIcon name="i-lucide-sun" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSwitch v-model="notificationPrefs.activeHoursEnabled" />
        </template>
      </UiSettingsRow>
      <template v-if="notificationPrefs.activeHoursEnabled">
        <UiSettingsRow title="Active hours start">
          <template #control>
            <UiInput
              v-model="notificationPrefs.activeHoursStart"
              type="time"
              class="account-notifications__time"
            />
          </template>
        </UiSettingsRow>
        <UiSettingsRow title="Active hours end">
          <template #control>
            <UiInput
              v-model="notificationPrefs.activeHoursEnd"
              type="time"
              class="account-notifications__time"
            />
          </template>
        </UiSettingsRow>
      </template>
      <UiSettingsRow
        title="Timezone"
        :description="`Current local time ${currentUserTime}`"
      >
        <template #leading>
          <UiIcon name="i-lucide-globe" class="h-4 w-4" />
        </template>
        <template #control>
          <UiSelect
            v-model="notificationPrefs.timezone"
            :items="timezoneOptions"
            value-key="value"
            label-key="label"
            size="sm"
            class="account-notifications__timezone"
            aria-label="Notification timezone"
          />
        </template>
      </UiSettingsRow>
    </UiSettingsGroup>

    <shared-error-message
      v-if="notificationError"
      :error="notificationError"
      :refresh="loadNotificationPreferences"
    />
    <UiButton
      block
      size="lg"
      :loading="notificationSaving"
      @click="saveNotificationPreferences"
    >
      Save reminder preferences
    </UiButton>

    <NotificationsInboxSheet v-model:open="inboxOpen" />
  </AccountPageFrame>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import type { APIError } from "~/services/FetchFactory";
import type {
  NotificationPreferencesDTO,
  NotificationSubscriptionsResponse,
} from "@@/shared/utils/notification.contract";
import NotificationsInboxSheet from "~/components/shell/NotificationsInboxSheet.vue";
import { useAccountContext } from "~/composables/account/useAccountContext";

definePageMeta({ middleware: "auth" });

const { $api } = useNuxtApp();
const { isDaily } = useAccountContext();
const toast = useToast();
const {
  checkPermission,
  checkSubscriptionStatus,
  currentEndpointHash,
  isLoading: subscriptionLoading,
  isSubscribed,
  registerNotification,
  unsubscribe,
} = useNotifications();
const { unreadCount } = useInAppNotifications();

const inboxOpen = ref(false);
const notificationPrefs = reactive<NotificationPreferencesDTO>({
  cardDueEnabled: true,
  cardDueTime: "09:00",
  cardDueThreshold: 5,
  dailyReminderEnabled: false,
  dailyReminderTime: "09:00",
  timezone: "UTC",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  sendAnytimeOutsideQuietHours: true,
  activeHoursEnabled: false,
  activeHoursStart: "09:00",
  activeHoursEnd: "21:00",
});
const notificationLoading = ref(false);
const notificationSaving = ref(false);
const notificationError = ref<APIError | string | null>(null);
const permissionStatus = ref<NotificationPermission | "unsupported">("default");
const subscriptionsLoading = ref(false);
const removingSubscriptionId = ref<string | null>(null);
const savedSubscriptions = ref<
  NotificationSubscriptionsResponse["subscriptions"]
>([]);

const timezoneOptions = ref([
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Australia/Sydney", label: "Sydney" },
]);
const currentServerSubscription = computed(() =>
  savedSubscriptions.value.find((subscription) => subscription.isCurrentDevice),
);
const currentDeviceConnected = computed(
  () =>
    permissionStatus.value === "granted" &&
    isSubscribed.value &&
    Boolean(currentServerSubscription.value),
);
const needsDeviceRepair = computed(
  () =>
    permissionStatus.value === "granted" &&
    (isSubscribed.value || savedSubscriptions.value.length > 0) &&
    !currentDeviceConnected.value,
);
const currentDeviceStatusLabel = computed(() => {
  if (permissionStatus.value === "unsupported") return "Not supported";
  if (permissionStatus.value === "denied") return "Blocked";
  if (currentDeviceConnected.value) return "Connected";
  if (needsDeviceRepair.value) return "Needs reconnect";
  if (permissionStatus.value === "granted") return "Not connected";
  return "Not enabled";
});
const currentDeviceStatusHint = computed(() => {
  if (permissionStatus.value === "unsupported") {
    return "This browser does not support push notifications.";
  }
  if (permissionStatus.value === "denied") {
    return "Browser permission is blocked. The in-app inbox still works.";
  }
  if (currentDeviceConnected.value) {
    return "This browser is allowed, subscribed, and registered on the server.";
  }
  if (needsDeviceRepair.value) {
    return "Browser and server delivery are out of sync. Reconnect to repair.";
  }
  return "Push is optional. In-app notifications still work without it.";
});
const savedDeviceSummary = computed(() => {
  if (subscriptionsLoading.value) return "Loading saved devices";
  const count = savedSubscriptions.value.length;
  if (count === 0) return "No browser devices registered";
  return `${count} registered ${count === 1 ? "device" : "devices"}`;
});
const currentUserTime = computed(() => {
  try {
    return new Date().toLocaleString(undefined, {
      timeZone: notificationPrefs.timezone,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
  } catch {
    return "Invalid timezone";
  }
});

function ensureTimezoneInOptions(tz: string) {
  if (!timezoneOptions.value.some((option) => option.value === tz)) {
    timezoneOptions.value.unshift({ value: tz, label: `${tz} (device)` });
  }
}

async function loadNotificationPreferences() {
  notificationLoading.value = true;
  notificationError.value = null;
  try {
    const result = await $api.notifications.getPreferences();
    if (result.success) Object.assign(notificationPrefs, result.data);
    else notificationError.value = result.error;

    const tz = import.meta.client
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "";
    if (tz) {
      ensureTimezoneInOptions(tz);
      if (!notificationPrefs.timezone || notificationPrefs.timezone === "UTC") {
        notificationPrefs.timezone = tz;
      }
    }
  } finally {
    notificationLoading.value = false;
  }
}

async function saveNotificationPreferences() {
  notificationSaving.value = true;
  notificationError.value = null;
  try {
    const result = await $api.notifications.updatePreferences({
      ...notificationPrefs,
    });
    if (result.success) {
      Object.assign(notificationPrefs, result.data);
      toast.add({ title: "Reminder preferences saved", color: "success" });
    } else {
      notificationError.value = result.error;
      toast.add({
        title: "Could not save reminders",
        description: result.error.message,
        color: "error",
      });
    }
  } finally {
    notificationSaving.value = false;
  }
}

async function refreshCurrentDeviceState() {
  try {
    permissionStatus.value = await checkPermission();
  } catch {
    permissionStatus.value = "unsupported";
  }
  await checkSubscriptionStatus();
}

async function loadSubscriptions() {
  subscriptionsLoading.value = true;
  try {
    const result = await $api.notifications.getSubscriptions(
      currentEndpointHash.value,
    );
    if (result.success) {
      savedSubscriptions.value = result.data.subscriptions;
    } else {
      notificationError.value = result.error;
    }
  } finally {
    subscriptionsLoading.value = false;
  }
}

async function loadDeviceDeliveryState() {
  await refreshCurrentDeviceState();
  await loadSubscriptions();
}

async function enableCurrentDevice() {
  const enabled = await registerNotification();
  await loadDeviceDeliveryState();
  toast.add({
    title: enabled ? "Notifications enabled" : "Could not enable notifications",
    color: enabled ? "success" : "error",
  });
}

async function disableCurrentDevice() {
  const disabled = await unsubscribe();
  await loadDeviceDeliveryState();
  toast.add({
    title: disabled ? "Device disabled" : "Could not disable device",
    color: disabled ? "success" : "error",
  });
}

async function removeSavedSubscription(
  subscriptionId: string,
  isCurrentDevice: boolean,
) {
  removingSubscriptionId.value = subscriptionId;
  try {
    if (isCurrentDevice) {
      await disableCurrentDevice();
      return;
    }

    const result = await $api.notifications.unsubscribe({ subscriptionId });
    if (!result.success) {
      toast.add({
        title: "Could not remove device",
        description: result.error.message,
        color: "error",
      });
      return;
    }
    await loadDeviceDeliveryState();
  } finally {
    removingSubscriptionId.value = null;
  }
}

function formatUserAgent(userAgent?: string | null) {
  if (!userAgent) return "Browser device";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "Safari on iOS";
  if (/Android/i.test(userAgent)) return "Android browser";
  if (/Chrome/i.test(userAgent)) return "Chrome";
  if (/Safari/i.test(userAgent)) return "Safari";
  if (/Firefox/i.test(userAgent)) return "Firefox";
  return "Browser device";
}

function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

onMounted(async () => {
  await Promise.all([loadNotificationPreferences(), loadDeviceDeliveryState()]);
});
</script>

<style scoped>
.account-notifications__inline-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.account-notifications__devices {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.account-notifications__device {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--component-card-radius);
  background: var(--color-surface-subtle);
}

.account-notifications__device-main {
  min-width: 0;
  flex: 1;
}

.account-notifications__device-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-content-on-surface-strong);
}

.account-notifications__device-meta {
  display: block;
  font-size: 11px;
  color: var(--color-content-secondary);
}

.account-notifications__time {
  width: 7.5rem;
}

.account-notifications__timezone {
  width: 10.5rem;
}
</style>
