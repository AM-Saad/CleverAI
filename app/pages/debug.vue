<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div class="max-w-7xl mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🔧 Debug Dashboard
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Comprehensive debugging tools for notifications, service workers, and
          system testing
        </p>
      </div>

      <!-- Quick Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-bell" class="w-5 h-5" />
              <span class="font-semibold">Notifications</span>
            </div>
          </template>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Permission:</span>
              <UBadge
                :color="
                  notificationStatus.permission === 'granted'
                    ? 'success'
                    : 'error'
                "
                variant="subtle"
              >
                {{ notificationStatus.permission }}
              </UBadge>
            </div>
            <div class="flex justify-between">
              <span>Subscribed:</span>
              <UBadge
                :color="notificationStatus.subscribed ? 'success' : 'error'"
                variant="subtle"
              >
                {{ notificationStatus.subscribed ? "Yes" : "No" }}
              </UBadge>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="w-5 h-5" />
              <span class="font-semibold">Service Worker</span>
            </div>
          </template>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Status:</span>
              <UBadge
                :color="swStatus.registered ? 'success' : 'error'"
                variant="subtle"
              >
                {{ swStatus.state || "Not Registered" }}
              </UBadge>
            </div>
            <div class="flex justify-between">
              <span>Debug Mode:</span>
              <UBadge
                :color="swStatus.debugEnabled ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ swStatus.debugEnabled ? "Enabled" : "Disabled" }}
              </UBadge>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-5 h-5" />
              <span class="font-semibold">Cron Tasks</span>
            </div>
          </template>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span>Status:</span>
              <UBadge
                :color="cronStatus.running ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ cronStatus.running ? "Running" : "Stopped" }}
              </UBadge>
            </div>
            <div class="flex justify-between">
              <span>Last Run:</span>
              <span class="text-sm text-gray-600">{{
                cronStatus.lastRun || "Never"
              }}</span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Main Content Tabs -->
      <UTabs v-model="selectedTab" :items="tabs" class="w-full">
        <!-- Notifications Tab -->
        <template #notifications="{ item }">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Permission Management -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">🔔 Permission Management</h3>
              </template>
              <div class="space-y-4">
                <UButton
                  color="primary"
                  :loading="loading.permission"
                  @click="checkPermission"
                >
                  Check Permission
                </UButton>
                <UButton
                  color="success"
                  :loading="loading.request"
                  @click="requestPermission"
                >
                  Request Permission
                </UButton>
                <UButton
                  color="success"
                  :loading="loading.direct"
                  @click="testDirectNotification"
                >
                  Test Direct Notification
                </UButton>
                <UButton
                  color="primary"
                  :loading="loading.test"
                  @click="sendTestNotification"
                >
                  Send API Test Notification
                </UButton>
              </div>
            </UCard>

            <!-- Test Notification Form -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">✉️ Test Notification</h3>
              </template>
              <div class="space-y-4">
                <UFormGroup label="Title">
                  <UInput
                    v-model="testNotification.title"
                    placeholder="Notification title"
                  />
                </UFormGroup>
                <UFormGroup label="Message">
                  <UTextarea
                    v-model="testNotification.message"
                    placeholder="Notification message"
                  />
                </UFormGroup>
                <UFormGroup label="URL">
                  <UInput
                    v-model="testNotification.url"
                    placeholder="/review"
                  />
                </UFormGroup>
                <UCheckbox
                  v-model="testNotification.requireInteraction"
                  label="Require Interaction"
                />
              </div>
            </UCard>
          </div>
        </template>

        <!-- Service Worker Tab -->
        <template #service-worker="{ item }">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- SW Management -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">
                  ⚙️ Service Worker Management
                </h3>
              </template>
              <div class="space-y-4">
                <UButton
                  color="primary"
                  :loading="loading.swCheck"
                  @click="checkServiceWorker"
                >
                  Check Service Worker
                </UButton>
                <UButton
                  color="primary"
                  :loading="loading.swDebug"
                  @click="enableSWDebugMode"
                >
                  Enable Debug Mode
                </UButton>
                <UButton
                  color="warning"
                  :loading="loading.swUpdate"
                  @click="forceServiceWorkerUpdate"
                >
                  Force Update
                </UButton>
                <UButton
                  color="success"
                  :loading="loading.swMessage"
                  @click="testServiceWorkerMessage"
                >
                  Test SW Message
                </UButton>
              </div>
            </UCard>

            <!-- Subscription Management -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">📡 Push Subscription</h3>
              </template>
              <div class="space-y-4">
                <UButton
                  color="primary"
                  :loading="loading.subscription"
                  @click="checkSubscription"
                >
                  Check Subscription
                </UButton>
                <UButton
                  color="warning"
                  :loading="loading.refresh"
                  @click="refreshSubscription"
                >
                  Refresh Subscription
                </UButton>
                <UButton
                  color="error"
                  :loading="loading.unsubscribe"
                  @click="unsubscribe"
                >
                  Unsubscribe
                </UButton>

                <div
                  v-if="subscriptionInfo"
                  class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded"
                >
                  <p class="text-sm font-mono break-all">
                    {{ subscriptionInfo.endpoint }}
                  </p>
                </div>
              </div>
            </UCard>
          </div>
        </template>

        <!-- Cron & Timing Tab -->
        <template #cron="{ item }">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Cron Testing -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">🕒 Cron Testing</h3>
              </template>
              <div class="space-y-4">
                <UButton
                  color="primary"
                  :loading="loading.cron"
                  @click="triggerCronCheck"
                >
                  Trigger Cron Check
                </UButton>
                <UButton
                  color="error"
                  :loading="loading.cooldown"
                  @click="clearCooldown"
                >
                  Clear Cooldown
                </UButton>
                <UButton
                  color="primary"
                  :loading="loading.timing"
                  @click="checkTimingGates"
                >
                  Check Timing Gates
                </UButton>
                <UButton
                  color="warning"
                  :loading="loading.bypass"
                  @click="bypassAllGates"
                >
                  Bypass All Gates
                </UButton>
              </div>
            </UCard>

            <!-- Timing Gates Status -->
            <UCard v-if="timingGates">
              <template #header>
                <h3 class="text-lg font-semibold">⏰ Timing Gates Status</h3>
              </template>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span>Active Hours:</span>
                  <UBadge
                    :color="timingGates.inActiveHours ? 'success' : 'error'"
                    variant="subtle"
                  >
                    {{ timingGates.inActiveHours ? "Inside" : "Outside" }}
                  </UBadge>
                </div>
                <div class="flex justify-between items-center">
                  <span>Quiet Hours:</span>
                  <UBadge
                    :color="timingGates.inQuietHours ? 'error' : 'success'"
                    variant="subtle"
                  >
                    {{ timingGates.inQuietHours ? "In Quiet" : "Not Quiet" }}
                  </UBadge>
                </div>
                <div class="flex justify-between items-center">
                  <span>Send Anytime:</span>
                  <UBadge
                    :color="timingGates.sendAnytime ? 'success' : 'neutral'"
                    variant="subtle"
                  >
                    {{ timingGates.sendAnytime ? "Enabled" : "Disabled" }}
                  </UBadge>
                </div>
                <div class="flex justify-between items-center">
                  <span>Current Time:</span>
                  <span class="text-sm">{{ timingGates.currentTime }}</span>
                </div>
                <div class="flex justify-between items-center">
                  <span>Recent Count:</span>
                  <span class="text-sm">{{ timingGates.recentCount }}</span>
                </div>
              </div>
            </UCard>
          </div>
        </template>

        <!-- Live Logs Tab -->
        <template #logs="{ item }">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Action Logs -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h3 class="text-lg font-semibold">📝 Action Logs</h3>
                  <UButton
                    color="success"
                    size="xs"
                    :disabled="logMonitoring"
                    @click="startLogMonitoring"
                  >
                    {{ logMonitoring ? "Monitoring..." : "Start Monitoring" }}
                  </UButton>
                </div>
              </template>
              <div
                ref="logsContainer"
                class="h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs"
              >
                <div v-for="(log, index) in logs" :key="index" class="mb-1">
                  <span class="text-gray-500">{{ log.timestamp }}</span>
                  <span
                    :class="{
                      'text-green-600': log.level === 'success',
                      'text-red-600': log.level === 'error',
                      'text-blue-600': log.level === 'info',
                      'text-yellow-600': log.level === 'warning',
                    }"
                    >[{{ log.level.toUpperCase() }}]</span
                  >
                  <span>{{ log.message }}</span>
                </div>
              </div>
            </UCard>

            <!-- Service Worker Logs -->
            <UCard>
              <template #header>
                <h3 class="text-lg font-semibold">🛠️ Service Worker Logs</h3>
              </template>
              <div
                class="h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded font-mono text-xs"
              >
                <div v-for="(log, index) in swLogs" :key="index" class="mb-1">
                  <span class="text-gray-500">{{ log.timestamp }}</span>
                  <span class="text-purple-600"
                    >[{{ log.type.toUpperCase() }}]</span
                  >
                  <span>{{ log.message }}</span>
                </div>
              </div>
            </UCard>
          </div>
        </template>
      </UTabs>

      <!-- Last Result Card -->
      <UCard v-if="lastResult" class="mt-8">
        <template #header>
          <h3 class="text-lg font-semibold">📊 Last Operation Result</h3>
        </template>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span class="font-medium">Operation:</span>
            <span>{{ lastResult.operation }}</span>
          </div>
          <div class="flex justify-between">
            <span class="font-medium">Success:</span>
            <UBadge
              :color="lastResult.success ? 'success' : 'error'"
              variant="subtle"
            >
              {{ lastResult.success ? "Success" : "Failed" }}
            </UBadge>
          </div>
          <div class="flex justify-between">
            <span class="font-medium">Time:</span>
            <span class="text-sm">{{ lastResult.timestamp }}</span>
          </div>
          <div v-if="lastResult.message" class="flex justify-between">
            <span class="font-medium">Message:</span>
            <span class="text-sm">{{ lastResult.message }}</span>
          </div>
          <div v-if="lastResult.data" class="mt-3">
            <span class="font-medium">Data:</span>
            <pre
              class="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto"
              >{{ JSON.stringify(lastResult.data, null, 2) }}</pre
            >
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: "Debug Dashboard",
  layout: "default",
});

// Tab configuration
const selectedTab = ref(0);
const tabs = [
  { key: "notifications", label: "Notifications", icon: "i-heroicons-bell" },
  {
    key: "service-worker",
    label: "Service Worker",
    icon: "i-heroicons-cog-6-tooth",
  },
  { key: "cron", label: "Cron & Timing", icon: "i-heroicons-clock" },
  { key: "logs", label: "Live Logs", icon: "i-heroicons-document-text" },
];

// Loading states
const loading = reactive({
  permission: false,
  request: false,
  direct: false,
  test: false,
  subscription: false,
  refresh: false,
  unsubscribe: false,
  swCheck: false,
  swDebug: false,
  swUpdate: false,
  swMessage: false,
  cron: false,
  cooldown: false,
  timing: false,
  bypass: false,
  preferences: false,
});

// Status tracking
const notificationStatus = reactive({
  permission: "default",
  subscribed: false,
});

const swStatus = reactive({
  registered: false,
  state: "unknown",
  debugEnabled: false,
});

const cronStatus = reactive({
  running: false,
  lastRun: null,
});

// Test notification form
const testNotification = reactive({
  title: "Test Notification",
  message: "This is a test message from the debug dashboard",
  icon: "/icons/192x192.png",
  tag: "debug-test",
  url: "/review",
  requireInteraction: false,
});

// Data stores
const timingGates = ref(null);
const subscriptionInfo = ref(null);
const logs = ref([]);
const swLogs = ref([]);
const logsContainer = ref();
const lastResult = ref(null);
const logMonitoring = ref(false);

// Helper functions
const addLog = (level: string, message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  logs.value.push({ timestamp, level, message });

  // Auto-scroll to bottom
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
    }
  });
};

const addSWLog = (type: string, message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  swLogs.value.push({ timestamp, type, message });
};

const setResult = (
  operation: string,
  success: boolean,
  data?: any,
  message?: string,
) => {
  lastResult.value = {
    operation,
    success,
    data,
    message,
    timestamp: new Date().toLocaleTimeString(),
  };
};

// Notification functions
const checkPermission = async () => {
  loading.permission = true;
  try {
    const permission = Notification.permission;
    notificationStatus.permission = permission;
    addLog("info", `Notification permission: ${permission}`);
    setResult("Check Permission", true, { permission });
  } catch (error: any) {
    addLog("error", `Permission check failed: ${error.message}`);
    setResult("Check Permission", false, null, error.message);
  } finally {
    loading.permission = false;
  }
};

const requestPermission = async () => {
  loading.request = true;
  try {
    const permission = await Notification.requestPermission();
    notificationStatus.permission = permission;
    addLog("success", `Permission granted: ${permission}`);
    setResult("Request Permission", permission === "granted", { permission });
  } catch (error: any) {
    addLog("error", `Permission request failed: ${error.message}`);
    setResult("Request Permission", false, null, error.message);
  } finally {
    loading.request = false;
  }
};

const testDirectNotification = async () => {
  loading.direct = true;
  try {
    const notification = new Notification(testNotification.title, {
      body: testNotification.message,
      icon: testNotification.icon,
      tag: testNotification.tag,
      requireInteraction: testNotification.requireInteraction,
      silent: false,
      actions: [],
    });

    notification.onclick = () => {
      window.open(testNotification.url, "_blank");
    };

    addLog("success", "Direct notification created successfully");
    setResult("Test Direct Notification", true, {
      title: testNotification.title,
    });
  } catch (error: any) {
    addLog("error", `Direct notification failed: ${error.message}`);
    setResult("Test Direct Notification", false, null, error.message);
  } finally {
    loading.direct = false;
  }
};

const sendTestNotification = async () => {
  loading.test = true;
  try {
    const { data } = await $fetch("/api/notifications/test", {
      method: "POST",
      body: testNotification,
    });
    addLog("success", "Test notification sent via API");
    setResult("Send Test Notification", true, data);
  } catch (error: any) {
    addLog("error", `API notification failed: ${error.message}`);
    setResult("Send Test Notification", false, null, error.message);
  } finally {
    loading.test = false;
  }
};

// Service Worker functions
const checkServiceWorker = async () => {
  loading.swCheck = true;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      swStatus.registered = !!registration;
      swStatus.state = registration?.active?.state || "not_registered";
      addLog("info", `Service Worker state: ${swStatus.state}`);
      setResult("Check Service Worker", true, {
        registered: swStatus.registered,
        state: swStatus.state,
      });
    } else {
      addLog("error", "Service Worker not supported");
      setResult("Check Service Worker", false, null, "Not supported");
    }
  } catch (error: any) {
    addLog("error", `SW check failed: ${error.message}`);
    setResult("Check Service Worker", false, null, error.message);
  } finally {
    loading.swCheck = false;
  }
};

const enableSWDebugMode = async () => {
  loading.swDebug = true;
  try {
    // Force SW reload with debug
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        addSWLog("message", JSON.stringify(event.data));
      });
      swStatus.debugEnabled = true;
      addLog("success", "SW debug mode enabled");
      setResult("Enable SW Debug", true);
    }
  } catch (error: any) {
    addLog("error", `SW debug mode error: ${error.message}`);
    setResult("Enable SW Debug", false, null, error.message);
  } finally {
    loading.swDebug = false;
  }
};

// Cron functions
const triggerCronCheck = async () => {
  loading.cron = true;
  try {
    const response: any = await $fetch(
      "/api/notifications/cron/check-due-cards",
      { method: "GET" },
    );
    addLog(
      "success",
      `Cron triggered: ${response.data.results.notificationsSent} sent, ${response.data.results.skipped} skipped`,
    );
    setResult("Trigger Cron Check", true, response.data);

    cronStatus.lastRun = new Date().toLocaleTimeString();
    cronStatus.running = true;
  } catch (error: any) {
    addLog("error", `Cron trigger failed: ${error.message}`);
    setResult("Trigger Cron Check", false, null, error.message);
  } finally {
    loading.cron = false;
  }
};

const clearCooldown = async () => {
  loading.cooldown = true;
  try {
    await $fetch("/api/notifications/clear-cooldown", { method: "POST" });
    addLog("success", "Notification cooldown cleared");
    setResult("Clear Cooldown", true);
  } catch (error: any) {
    addLog("error", `Clear cooldown failed: ${error.message}`);
    setResult("Clear Cooldown", false, null, error.message);
  } finally {
    loading.cooldown = false;
  }
};

const checkTimingGates = async () => {
  loading.timing = true;
  try {
    const data: any = await $fetch("/api/notifications/debug-cron");
    timingGates.value = {
      timezone: data.timezone,
      currentTime: data.currentTime,
      activeHoursEnabled: data.activeHoursEnabled,
      activeHoursStart: data.activeHoursStart,
      activeHoursEnd: data.activeHoursEnd,
      quietHoursEnabled: data.quietHoursEnabled,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
      sendAnytime: data.sendAnytime,
      recentCount: data.recentCount,
      inActiveHours: data.inActiveHours,
      inQuietHours: data.inQuietHours,
    };
    addLog("success", "Timing gates checked successfully");
    setResult("Check Timing Gates", true, data);
  } catch (error: any) {
    addLog("error", `Timing gates check failed: ${error.message}`);
    setResult("Check Timing Gates", false, null, error.message);
  } finally {
    loading.timing = false;
  }
};

const bypassAllGates = async () => {
  loading.bypass = true;
  try {
    await $fetch("/api/notifications/preferences", {
      method: "PUT",
      body: {
        timezone: "Africa/Cairo",
        activeHoursEnabled: false,
        quietHoursEnabled: false,
        sendAnytime: true,
        cardDueThreshold: 1,
      },
    });
    addLog("success", "All timing gates bypassed");
    setResult("Bypass All Gates", true);
    await checkTimingGates();
  } catch (error: any) {
    addLog("error", `Bypass gates failed: ${error.message}`);
    setResult("Bypass All Gates", false, null, error.message);
  } finally {
    loading.bypass = false;
  }
};

// Subscription functions
const checkSubscription = async () => {
  loading.subscription = true;
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        notificationStatus.subscribed = !!subscription;

        subscriptionInfo.value = subscription
          ? {
              endpoint: subscription.endpoint,
              keys: JSON.stringify(subscription.toJSON().keys, null, 2),
            }
          : null;

        addLog(
          "info",
          `Subscription status: ${subscription ? "Active" : "None"}`,
        );
        setResult("Check Subscription", true, { subscribed: !!subscription });
      }
    }
  } catch (error: any) {
    addLog("error", `Subscription check failed: ${error.message}`);
    setResult("Check Subscription", false, null, error.message);
  } finally {
    loading.subscription = false;
  }
};

const refreshSubscription = async () => {
  loading.refresh = true;
  try {
    // Implementation would go here
    addLog("info", "Subscription refresh initiated");
    setResult("Refresh Subscription", true);
  } catch (error: any) {
    addLog("error", `Subscription refresh failed: ${error.message}`);
    setResult("Refresh Subscription", false, null, error.message);
  } finally {
    loading.refresh = false;
  }
};

const unsubscribe = async () => {
  loading.unsubscribe = true;
  try {
    // Implementation would go here
    addLog("info", "Unsubscribe initiated");
    setResult("Unsubscribe", true);
  } catch (error: any) {
    addLog("error", `Unsubscribe failed: ${error.message}`);
    setResult("Unsubscribe", false, null, error.message);
  } finally {
    loading.unsubscribe = false;
  }
};

// Additional placeholder functions
const forceServiceWorkerUpdate = async () => {
  loading.swUpdate = true;
  addLog("info", "SW update initiated");
  setResult("Force SW Update", true);
  loading.swUpdate = false;
};

const testServiceWorkerMessage = async () => {
  loading.swMessage = true;
  addLog("info", "SW message test initiated");
  setResult("Test SW Message", true);
  loading.swMessage = false;
};

const startLogMonitoring = () => {
  logMonitoring.value = true;
  addLog("info", "Log monitoring started");
};

// Initialize
onMounted(async () => {
  await checkPermission();
  await checkServiceWorker();
  await checkSubscription();
  await checkTimingGates();
});
</script>
