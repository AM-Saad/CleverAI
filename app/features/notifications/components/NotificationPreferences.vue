<template>
  <!-- eslint-disable vue/max-attributes-per-line, vue/attributes-order -->
  <UiPanel size="md" variant="transparent">

    <template #header>
      <div class="flex items-center gap-2">
        <UiIcon name="i-lucide-bell" class="w-5 h-5" />
        Notification Preferences
      </div>
    </template>

    <div class="space-y-6">

      <UiPanel variant="surface" size="sm">
        <template #header>
          <div class="flex w-full items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <UiIcon name="i-lucide-smartphone" class="h-5 w-5" />
                Browser delivery
              </div>
              <ui-paragraph>
                Manage this browser and other saved push-notification devices.
              </ui-paragraph>
            </div>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-medium"
              :class="currentDeviceStatusClass"
            >
              {{ currentDeviceStatusLabel }}
            </span>
          </div>
        </template>

        <div class="space-y-4">
          <ui-paragraph size="sm" color="content-secondary">
            {{ currentDeviceStatusHint }}
          </ui-paragraph>

          <div class="flex flex-wrap gap-2">
            <ui-button
              v-if="!currentDeviceConnected"
              size="sm"
              :loading="subscriptionLoading"
              icon="i-lucide-bell"
              @click="enableCurrentDevice"
            >
              {{ needsDeviceRepair ? "Reconnect this device" : "Enable this device" }}
            </ui-button>
            <ui-button
              v-else
              size="sm"
              variant="soft"
              :loading="subscriptionLoading"
              icon="i-lucide-bell-off"
              @click="disableCurrentDevice"
            >
              Disable this device
            </ui-button>
            <ui-button
              size="sm"
              variant="ghost"
              :loading="subscriptionsLoading"
              icon="i-lucide-refresh-cw"
              @click="loadDeviceDeliveryState"
            >
              Refresh
            </ui-button>
          </div>

          <UiPanel
            v-if="permissionStatus === 'denied'"
            variant="subtle"
            size="sm"
            role="alert"
            class-name="border-error/30 bg-error/10"
          >
            <ui-paragraph size="sm" color="danger">
              Notifications are blocked by this browser. Allow them from the
              site permissions, then reconnect this device.
            </ui-paragraph>
          </UiPanel>

          <div class="border-t border-secondary pt-4">
            <div class="mb-3 flex items-center justify-between">
              <ui-label weight="semibold">Saved devices</ui-label>
              <ui-paragraph size="xs" color="content-secondary">
                {{ savedSubscriptions.length }} registered
              </ui-paragraph>
            </div>

            <div v-if="subscriptionsLoading" class="py-4 text-center">
              <UiIcon
                name="i-lucide-refresh-cw"
                class="mx-auto h-5 w-5 animate-spin text-primary"
              />
            </div>

            <UiPanel
              v-else-if="savedSubscriptions.length === 0"
              variant="subtle"
              size="md"
            >
              <ui-paragraph size="sm" color="content-secondary">
                No browser devices are registered. In-app notifications will
                still remain available in the header inbox.
              </ui-paragraph>
            </UiPanel>

            <div v-else class="space-y-2">
              <UiPanel
                v-for="subscription in savedSubscriptions"
                :key="subscription.id"
                variant="surface"
                size="sm"
                content-class="flex items-start justify-between gap-3"
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <ui-label>{{ formatUserAgent(subscription.userAgent) }}</ui-label>
                    <span
                      v-if="subscription.isCurrentDevice"
                      class="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success-text"
                    >
                      This device
                    </span>
                    <span
                      v-if="!subscription.isActive"
                      class="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning-text"
                    >
                      Inactive
                    </span>
                  </div>
                  <ui-paragraph size="xs" color="content-secondary" class="mt-1 truncate">
                    Last connected {{ formatDate(subscription.lastSeen || subscription.createdAt) }}
                  </ui-paragraph>
                </div>
                <UiDoubleTapDeleteButton
                  hide-label
                  icon="i-lucide-trash-2"
                  label="Remove saved notification device"
                  armed-label="Tap again to remove device"
                  size="xs"
                  variant="ghost"
                  :loading="removingSubscriptionId === subscription.id"
                  :disabled="Boolean(removingSubscriptionId && removingSubscriptionId !== subscription.id)"
                  :reset-key="subscription.id"
                  @confirm="removeSavedSubscription(subscription.id, subscription.isCurrentDevice)"
                />
              </UiPanel>
            </div>
          </div>
        </div>
      </UiPanel>

      <!-- Card Due Notifications -->
      <UiPanel variant="surface" size="sm">
        <template #header>
          <div>
            📚 Card Due Notifications
            <ui-paragraph>Get notified when you have cards ready for review</ui-paragraph>
          </div>
          <UiSwitch v-model="preferences.cardDueEnabled" :loading="loading" @change="updatePreferences" />
        </template>

        <!-- Card Due Settings -->
        <div v-if="preferences.cardDueEnabled" class="space-y-3">

          <UiFormField label="How often would you like to be notified?"
            help="Choose how often you'd like to be notified about due cards">
            <div class="space-y-3">
              <!-- Threshold Selection -->
              <div class="grid grid-cols-1 gap-3">
                <UiInteractiveCard
                  v-for="option in thresholdOptions"
                  :key="option.value"
                  variant="outline"
                  size="sm"
                  selectable
                  :selected="preferences.cardDueThreshold === option.value"
                  @click="selectThreshold(option.value)">
                  <div class="flex items-start gap-3">
                    <div class="text-xl">{{ option.emoji }}</div>
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <ui-label weight="medium">
                          {{ option.title }}
                        </ui-label>
                        <span
                          class="text-xs text-content-secondary bg-secondary dark:bg-muted px-2 py-1 rounded-[var(--radius-md)]">
                          {{ option.value }}+ cards
                        </span>
                      </div>
                      <ui-paragraph class="mt-1 text-wrap">
                        {{ option.description }}
                      </ui-paragraph>
                    </div>
                    <div v-if="preferences.cardDueThreshold === option.value" class="text-primary">
                      <UiIcon name="i-lucide-circle-check" class="w-5 h-5" />
                    </div>
                  </div>
                </UiInteractiveCard>
              </div>

              <!-- Custom Threshold Option -->
              <UiPanel
                variant="surface"
                size="md"
                :class-name="isCustomThreshold ? 'border-primary bg-primary/10' : 'hover:bg-surface-subtle'"
                @click="selectCustomThreshold">
                <div class="flex items-start gap-3">
                  <div class="text-2xl">⚙️</div>
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <ui-title tag="h4" size="base" weight="medium" color="content-on-surface-strong" class="dark:text-content-on-surface">
                        Custom
                      </ui-title>
                      <div v-if="isCustomThreshold" class="flex items-center gap-2">
                        <UiInput v-model.number="customThresholdValue" type="number" min="1" max="100" class="w-20"
                          size="sm" :loading="loading" @input="updateCustomThreshold" />
                        <span class="text-xs text-content-secondary">cards</span>
                      </div>
                    </div>
                    <p class="text-sm text-content-secondary dark:text-content-secondary mt-1">
                      Set your own notification threshold
                    </p>
                  </div>
                  <div v-if="isCustomThreshold" class="text-primary">
                    <UiIcon name="i-lucide-circle-check" class="w-5 h-5" />
                  </div>
                </div>
              </UiPanel>
            </div>
          </UiFormField>
        </div>
      </UiPanel>







      <!-- Daily Study Reminders -->
      <UiPanel variant="surface">

        <template #header>
          <div>
            📅 Daily Study Reminders
            <ui-paragraph>Get reminded to study at a specific time each day</ui-paragraph>
          </div>
          <UiSwitch v-model="preferences.dailyReminderEnabled" :loading="loading" @change="updatePreferences" />
        </template>

        <!-- Daily Reminder Settings -->
        <div v-if="preferences.dailyReminderEnabled" class="pl-4 border-l-2 border-secondary">
          <UiFormField label="Reminder Time" help="What time would you like your daily reminder?">
            <div class="flex items-center gap-2">
              <UiIcon name="i-lucide-clock" class="w-4 h-4 text-content-secondary" />
              <!-- design-allow: native time picker — no Ui primitive wraps type=time -->
              <input v-model="preferences.dailyReminderTime" type="time"
                class="px-3 py-2 border border-secondary rounded-[var(--radius-md)] bg-white dark:bg-surface text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
                :disabled="loading" @change="updatePreferences" />
            </div>
          </UiFormField>
        </div>
      </UiPanel>




      <!-- Quiet Hours -->
      <UiPanel variant="surface">
        <template #header>
          <div>
            🤫 Quiet Hours
            <ui-paragraph>
              No notifications during these hours
            </ui-paragraph>
          </div>
          <UiSwitch v-model="preferences.quietHoursEnabled" :loading="loading" @change="updatePreferences" />
        </template>

        <!-- Quiet Hours Settings -->
        <div v-if="preferences.quietHoursEnabled" class="space-y-3 pl-4 border-l-2 border-secondary">
          <div class="grid grid-cols-2 gap-4">
            <UiFormField label="Start Time">
              <div class="flex items-center gap-2">
                <UiIcon name="i-lucide-moon" class="w-4 h-4 text-content-secondary" />
                <!-- design-allow: native time picker — no Ui primitive wraps type=time -->
                <input v-model="preferences.quietHoursStart" type="time"
                  class="px-3 py-2 border border-secondary rounded-[var(--radius-md)] bg-white dark:bg-surface text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
                  :disabled="loading" @change="updatePreferences" />
              </div>
            </UiFormField>

            <UiFormField label="End Time">
              <div class="flex items-center gap-2">
                <UiIcon name="i-lucide-sun" class="w-4 h-4 text-content-secondary" />
                <!-- design-allow: native time picker — no Ui primitive wraps type=time -->
                <input v-model="preferences.quietHoursEnd" type="time"
                  class="px-3 py-2 border border-secondary rounded-[var(--radius-md)] bg-white dark:bg-surface text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
                  :disabled="loading" @change="updatePreferences" />
              </div>
            </UiFormField>
          </div>

          <div class="text-xs text-content-secondary flex items-center gap-1">
            <UiIcon name="i-lucide-info" class="w-3 h-3" />
            <span>
              Notifications will be delayed until after quiet hours end.
            </span>
          </div>
        </div>
      </UiPanel>





      <!-- Send Anytime (outside quiet hours) -->
      <UiPanel variant="surface">
        <template #header>
          <div>
            🚀 Send Anytime (Outside Quiet Hours)
            <ui-paragraph class="text-wrap">
              If enabled, notifications can send at any time outside quiet hours
              once your due-card threshold is met.
            </ui-paragraph>
          </div>
          <UiSwitch v-model="preferences.sendAnytimeOutsideQuietHours" :loading="loading" @change="updatePreferences" />
        </template>

        <div class="text-xs text-content-secondary flex items-center gap-1">
          <UiIcon name="i-lucide-info" class="w-3 h-3" />
          <span>
            When disabled, notifications only send near your Card Due Time.
          </span>
        </div>
      </UiPanel>





      <!-- Active Hours -->
      <UiPanel variant="surface">
        <template #header>
          <div>
            🕘 Active Hours
            <ui-paragraph class="text-wrap">
              Only send notifications during these hours (in addition to quiet
              hours).
            </ui-paragraph>
          </div>
          <UiSwitch v-model="preferences.activeHoursEnabled" :loading="loading" @change="updatePreferences" />
        </template>

        <div v-if="preferences.activeHoursEnabled" class="space-y-3 pl-4 border-l-2 border-secondary">
          <div class="grid grid-cols-2 gap-4">
            <UiFormField label="Start">
              <div class="flex items-center gap-2">
                <UiIcon name="i-lucide-play" class="w-4 h-4 text-content-secondary" />
                <!-- design-allow: native time picker — no Ui primitive wraps type=time -->
                <input v-model="preferences.activeHoursStart" type="time"
                  class="px-3 py-2 border border-secondary rounded-[var(--radius-md)] bg-white dark:bg-surface text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
                  :disabled="loading" @change="updatePreferences" />
              </div>
            </UiFormField>

            <UiFormField label="End">
              <div class="flex items-center gap-2">
                <UiIcon name="i-lucide-square" class="w-4 h-4 text-content-secondary" />
                <!-- design-allow: native time picker — no Ui primitive wraps type=time -->
                <input v-model="preferences.activeHoursEnd" type="time"
                  class="px-3 py-2 border border-secondary rounded-[var(--radius-md)] bg-white dark:bg-surface text-content-on-surface focus-visible:outline-none focus-visible:ring-0 focus-visible:[outline-style:solid] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-focus-outline-color)]"
                  :disabled="loading" @change="updatePreferences" />
              </div>
            </UiFormField>
          </div>
          <div class="text-xs text-content-secondary flex items-center gap-1">
            <UiIcon name="i-lucide-info" class="w-3 h-3" />
            <span> Midnight crossover is supported (e.g., 22:00–06:00). </span>
          </div>
        </div>
      </UiPanel>




      <!-- Timezone Settings -->
      <UiPanel variant="surface">
        <template #header>
          <div>
            🌍 Timezone
            <ui-paragraph>
              Set your local timezone for accurate notification timing
            </ui-paragraph>
          </div>
        </template>

        <UiFormField label="Your Timezone" help="All notification times will be converted to your local timezone">
          <div class="relative inline-flex items-center gap-2">
            <UiIcon name="i-lucide-globe" class="w-4 h-4 text-content-secondary" />
            <select v-model="preferences.timezone" :disabled="loading"
              class="px-2.5 py-1.5 text-sm rounded-[var(--radius-md)] bg-white dark:bg-surface border border-secondary text-content-on-surface"
              @change="updatePreferences">
              <option disabled value="">Select your timezone</option>
              <option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
          </div>
        </UiFormField>

        <div class="text-xs text-content-secondary flex items-center gap-1 my-1">
          <UiIcon name="i-lucide-info" class="w-3 h-3" />
          <span>
            Current time in your timezone: {{ getCurrentUserTime() }}
          </span>
        </div>
      </UiPanel>


    </div>

    <!-- Save Status -->
    <template v-if="lastSaved" #footer>
      <div class="flex items-center gap-2 text-sm text-content-secondary">
        <UiIcon name="i-lucide-circle-check" class="w-4 h-4 text-success-text" />
        <span>Settings saved {{ formatRelativeTime(lastSaved) }}</span>
      </div>
    </template>
  </UiPanel>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useDebounceFn } from "@vueuse/core";
import { useToast } from "#imports";
import type { NotificationSubscriptionsResponse } from "@@/shared/utils/notification.contract";
import { useNotifications } from "../composables/useNotifications";

interface NotificationPreferences {
  cardDueEnabled: boolean;
  cardDueTime: string;
  cardDueThreshold: number;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string;
  timezone: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  sendAnytimeOutsideQuietHours: boolean;
  activeHoursEnabled: boolean;
  activeHoursStart: string;
  activeHoursEnd: string;
}

const toast = useToast();
const { $api } = useNuxtApp();
type NotificationsApi = {
  getSubscriptions?: (currentEndpointHash?: string | null) => Promise<{
    success: boolean;
    data: NotificationSubscriptionsResponse;
    error?: { message?: string };
  }>;
  unsubscribe?: (payload: { endpoint?: string; subscriptionId?: string }) => Promise<{
    success: boolean;
    error?: { message?: string };
  }>;
};
const getNotificationsApi = () =>
  ($api as unknown as { notifications?: NotificationsApi }).notifications;
const {
  checkPermission,
  checkSubscriptionStatus,
  currentEndpointHash,
  isLoading: subscriptionLoading,
  isSubscribed,
  registerNotification,
  unsubscribe,
} = useNotifications();
const loading = ref(false);
const lastSaved = ref<Date | null>(null);
const permissionStatus = ref<NotificationPermission | "unsupported">("default");
const subscriptionsLoading = ref(false);
const removingSubscriptionId = ref<string | null>(null);
const savedSubscriptions = ref<NotificationSubscriptionsResponse["subscriptions"]>([]);

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
const currentDeviceStatusClass = computed(() => {
  if (currentDeviceConnected.value) return "bg-success/10 text-success-text";
  if (
    permissionStatus.value === "denied" ||
    permissionStatus.value === "unsupported"
  ) {
    return "bg-error/10 text-error-text";
  }
  if (needsDeviceRepair.value || permissionStatus.value === "granted") {
    return "bg-warning/10 text-warning-text";
  }
  return "bg-surface-subtle text-content-secondary";
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
    return "The browser and server subscription are out of sync. Reconnect to repair delivery.";
  }
  return "Push is optional. In-app notifications remain available without it.";
});

// Threshold options with engaging categories
const thresholdOptions = [
  {
    value: 1,
    title: "Instant Learner",
    emoji: "⚡",
    description:
      "Get notified as soon as any item is due. Perfect for staying on top of every review.",
  },
  {
    value: 3,
    title: "Steady Studier",
    emoji: "📚",
    description:
      "Be notified when you have a few items ready. Great for regular, bite-sized study sessions.",
  },
  {
    value: 5,
    title: "Focused Reviewer",
    emoji: "🎯",
    description:
      "Build up a small batch before reviewing. Ideal for concentrated study periods.",
  },
  {
    value: 10,
    title: "Batch Processor",
    emoji: "📊",
    description:
      "Wait for a decent stack to accumulate. Perfect for longer, dedicated study sessions.",
  },
  {
    value: 20,
    title: "Power Learner",
    emoji: "💪",
    description: "Great for intensive study marathons and maximum efficiency.",
  },
];

// Timezone options for common timezones (mutable so we can inject the user's zone)
const timezoneOptions = ref([
  { value: "UTC", label: "🌍 UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "🗽 Eastern Time (New York)" },
  { value: "America/Chicago", label: "🏙️ Central Time (Chicago)" },
  { value: "America/Denver", label: "🏔️ Mountain Time (Denver)" },
  { value: "America/Los_Angeles", label: "🌴 Pacific Time (Los Angeles)" },
  { value: "Europe/London", label: "🇬🇧 London (GMT/BST)" },
  { value: "Europe/Paris", label: "🇫🇷 Paris (CET/CEST)" },
  { value: "Europe/Berlin", label: "🇩🇪 Berlin (CET/CEST)" },
  { value: "Europe/Rome", label: "🇮🇹 Rome (CET/CEST)" },
  { value: "Asia/Tokyo", label: "🇯🇵 Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "🇨🇳 Shanghai (CST)" },
  { value: "Asia/Dubai", label: "🇦🇪 Dubai (GST)" },
  { value: "Australia/Sydney", label: "🇦🇺 Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "🇳🇿 Auckland (NZST/NZDT)" },
]);

const ensureTimezoneInOptions = (tz: string) => {
  if (!timezoneOptions.value.some((o) => o.value === tz)) {
    timezoneOptions.value.unshift({
      value: tz,
      label: `🕒 ${tz} (Your device)`,
    });
  }
};

// (Note) USelect binds directly to the timezone string using items with value/label.

// Helper function to get current time in user's timezone
const getCurrentUserTime = () => {
  try {
    const now = new Date();
    return now.toLocaleString("en-US", {
      timeZone: preferences.value.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      weekday: "short",
    });
  } catch (error) {
    console.error("Error getting user time:", error);
    return "Invalid timezone";
  }
};

// Custom threshold state
const customThresholdValue = ref(5);

// Computed properties
const isCustomThreshold = computed(() => {
  return !thresholdOptions.some(
    (option) => option.value === preferences.value.cardDueThreshold,
  );
});

// Threshold selection methods
const selectThreshold = (value: number) => {
  preferences.value.cardDueThreshold = value;
  updatePreferences();
};

const selectCustomThreshold = () => {
  preferences.value.cardDueThreshold = customThresholdValue.value;
  updatePreferences();
};

const updateCustomThreshold = () => {
  preferences.value.cardDueThreshold = customThresholdValue.value;
  updatePreferences();
};

// Reactive preferences state
const preferences = ref<NotificationPreferences>({
  cardDueEnabled: true,
  cardDueTime: "09:00",
  cardDueThreshold: 5,
  dailyReminderEnabled: false,
  dailyReminderTime: "19:00",
  timezone: "UTC",
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  sendAnytimeOutsideQuietHours: false,
  activeHoursEnabled: false,
  activeHoursStart: "09:00",
  activeHoursEnd: "21:00",
});

// Load preferences on mount
onMounted(async () => {
  await Promise.all([loadPreferences(), loadDeviceDeliveryState()]);
  // After loading server preferences, detect browser timezone and apply sensible defaults
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      ensureTimezoneInOptions(tz);
      // If server has no timezone or it's the generic UTC, default to user's device timezone
      if (!preferences.value.timezone || preferences.value.timezone === "UTC") {
        preferences.value.timezone = tz;
        // Persist the detected timezone (debounced)
        updatePreferences();
      }
    }
  } catch (e) {
    console.warn("Could not detect browser timezone:", e);
  }
});

const refreshCurrentDeviceState = async () => {
  try {
    permissionStatus.value = await checkPermission();
  } catch {
    permissionStatus.value = "unsupported";
  }
  await checkSubscriptionStatus();
};

const loadSubscriptions = async () => {
  subscriptionsLoading.value = true;
  try {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.getSubscriptions) {
      savedSubscriptions.value = [];
      console.warn("[notifications] Subscription API is unavailable");
      return;
    }

    const result = await notificationsApi.getSubscriptions(currentEndpointHash.value);
    if (!result.success) {
      toast.add({
        title: "Could not load devices",
        description: result.error?.message ?? "The notification device list is unavailable.",
        color: "error",
      });
      return;
    }
    savedSubscriptions.value = result.data.subscriptions;
  } finally {
    subscriptionsLoading.value = false;
  }
};

async function loadDeviceDeliveryState() {
  await refreshCurrentDeviceState();
  await loadSubscriptions();
}

async function enableCurrentDevice() {
  const enabled = await registerNotification();
  await loadDeviceDeliveryState();
  toast.add({
    title: enabled ? "Notifications enabled" : "Could not enable notifications",
    description: enabled
      ? "This browser is connected for push reminders."
      : "Check browser permission and try again. The in-app inbox still works.",
    color: enabled ? "success" : "error",
  });
}

async function disableCurrentDevice() {
  const disabled = await unsubscribe();
  await loadDeviceDeliveryState();
  toast.add({
    title: disabled ? "Device disabled" : "Could not disable device",
    description: disabled
      ? "This browser will stop receiving push reminders."
      : "The device state could not be changed. Try again shortly.",
    color: disabled ? "success" : "error",
  });
}

async function removeSavedSubscription(
  subscriptionId: string,
  isCurrentDevice: boolean,
) {
  if (isCurrentDevice) {
    await disableCurrentDevice();
    return;
  }

  removingSubscriptionId.value = subscriptionId;
  try {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.unsubscribe) {
      toast.add({
        title: "Could not remove device",
        description: "The notification device API is unavailable.",
        color: "error",
      });
      return;
    }

    const result = await notificationsApi.unsubscribe({ subscriptionId });
    if (!result.success) {
      toast.add({
        title: "Could not remove device",
        description: result.error?.message ?? "The notification device could not be removed.",
        color: "error",
      });
      return;
    }
    savedSubscriptions.value = savedSubscriptions.value.filter(
      (subscription) => subscription.id !== subscriptionId,
    );
    toast.add({
      title: "Device removed",
      description: "That browser will no longer receive push reminders.",
      color: "success",
    });
  } finally {
    removingSubscriptionId.value = null;
  }
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "unknown";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return "Browser device";
  if (userAgent.includes("iPhone")) return "iPhone browser";
  if (userAgent.includes("iPad")) return "iPad browser";
  if (userAgent.includes("Android")) return "Android browser";
  if (userAgent.includes("Mac OS X")) return "Mac browser";
  if (userAgent.includes("Windows")) return "Windows browser";
  return "Browser device";
}

// Load preferences from API
const loadPreferences = async () => {
  try {
    loading.value = true;
    const { data } = await $fetch("/api/notifications/preferences");

    if (data) {
      preferences.value = { ...preferences.value, ...data };
      // Initialize custom threshold value
      if (isCustomThreshold.value) {
        customThresholdValue.value = preferences.value.cardDueThreshold;
      }
      // Make sure the current preference timezone appears in the list
      if (preferences.value.timezone) {
        ensureTimezoneInOptions(preferences.value.timezone);
      }
    }
  } catch (error) {
    console.error("Failed to load notification preferences:", error);
    toast.add({
      title: "Error",
      description: "Failed to load notification preferences",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

// Debounced update function
const updatePreferences = useDebounceFn(async () => {
  try {
    loading.value = true;

    await $fetch("/api/notifications/preferences", {
      method: "PUT",
      body: preferences.value,
    });

    lastSaved.value = new Date();

    toast.add({
      title: "Settings Saved",
      description: "Your notification preferences have been updated",
      color: "success",
    });
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    toast.add({
      title: "Error",
      description: "Failed to save notification preferences",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}, 1000); // 1 second debounce

// Format relative time helper
const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};
</script>
