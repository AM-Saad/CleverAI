<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <UiDialogModal :show="showModal">
      <template #header>
        <div>
          <div
            class="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <UIcon name="i-heroicons-bell" class="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Stay on Track with Your Learning
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Get timely reminders when your flashcards are ready for review
          </p>
        </div>
      </template>
      <template #body>
        <!-- Benefits -->
        <div class="space-y-3 mb-6">
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                Perfect Timing
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                Get notified exactly when cards are due for optimal memory
                retention
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                Customizable Schedule
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                Set your preferred time, timezone, and quiet hours
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                Respect Your Time
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                Only notified when you have enough cards to make it worthwhile
              </div>
            </div>
          </div>
        </div>

        <!-- Permission Status -->
        <div v-if="permissionStatus === 'denied'"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="flex items-start gap-2">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-red-800 dark:text-red-200">
                Notifications Blocked
              </div>
              <div class="text-xs text-red-600 dark:text-red-300 mt-1">
                Please click the lock icon in your browser's address bar and
                allow notifications for this site.
              </div>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div class="text-sm text-red-800 dark:text-red-200">
            {{ error }}
          </div>
        </div>
      </template>
      <!-- Action Buttons -->
      <template #footer>
        <div class="space-y-3">
          <UButton :loading="isLoading" :disabled="permissionStatus === 'denied'" color="primary" size="lg" block
            @click="handleEnableNotifications">
            <template v-if="isLoading">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-2" />
              Setting up notifications...
            </template>
            <template v-else>
              <UIcon name="i-heroicons-bell" class="w-4 h-4 mr-2" />
              Enable Smart Notifications
            </template>
          </UButton>

          <UButton color="neutral" variant="ghost" size="lg" block @click="handleMaybeLater">
            Maybe Later
          </UButton>

          <!-- Don't ask again option -->
          <div class="flex items-center justify-center gap-2 pt-2">
            <UCheckbox v-model="dontAskAgain" :disabled="isLoading" />
            <label for="dontAskAgain" class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer"
              @click="dontAskAgain = !dontAskAgain">
              Don't ask me again
            </label>
          </div>
        </div>

        <!-- Privacy Note -->
        <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div class="text-xs text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4 inline mr-1" />
            Your notification preferences are stored locally and can be changed
            anytime in Settings.
          </div>
        </div>
      </template>
    </UiDialogModal>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  show: boolean;
}

interface Emits {
  (event: "close" | "subscribed" | "dismissed"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { registerNotification, isLoading, error, checkPermission } =
  useNotifications();
const toast = useToast();

// Local state
const showModal = ref(props.show);
const dontAskAgain = ref(false);
const permissionStatus = ref<NotificationPermission>("default");

// Watch props to sync modal visibility
watch(
  () => props.show,
  (newValue) => {
    showModal.value = newValue;
    if (newValue) {
      checkCurrentPermission();
    }
  },
);

// Watch modal state to emit close event
watch(showModal, (newValue) => {
  if (!newValue) {
    emit("close");
  }
});

// Check current notification permission status
const checkCurrentPermission = async () => {
  try {
    permissionStatus.value = await checkPermission();
  } catch (err) {
    console.error("Error checking permission:", err);
  }
};

// Handle enable notifications
const handleEnableNotifications = async () => {
  try {
    await registerNotification();

    // Success feedback
    toast.add({
      title: "🔔 Notifications Enabled!",
      description:
        "You'll now receive smart study reminders. You can customize them in Settings.",
      color: "success",
    });

    // Close modal and emit success
    showModal.value = false;
    emit("subscribed");

    // Save preference that user has been prompted and accepted
    if (import.meta.client) {
      localStorage.setItem(
        "notificationPrompted",
        JSON.stringify({
          timestamp: Date.now(),
          action: "subscribed",
        }),
      );
    }
  } catch (err) {
    console.error("Failed to enable notifications:", err);

    // Check if it's a permission issue
    const currentPermission = await checkPermission();
    permissionStatus.value = currentPermission;

    if (currentPermission === "denied") {
      // Don't show error toast for denied permission, the UI will show instructions
      return;
    }

    // Show error toast for other issues
    toast.add({
      title: "Setup Failed",
      description: "Unable to set up notifications. Please try again.",
      color: "error",
    });
  }
};

// Handle maybe later
const handleMaybeLater = () => {
  showModal.value = false;
  emit("dismissed");

  // Save preference
  if (import.meta.client) {
    const preference = {
      timestamp: Date.now(),
      action: "dismissed",
      dontAskAgain: dontAskAgain.value,
    };

    localStorage.setItem("notificationPrompted", JSON.stringify(preference));

    if (dontAskAgain.value) {
      toast.add({
        title: "Notifications Disabled",
        description: "You can enable them anytime in Settings → Notifications.",
        color: "neutral",
      });
    }
  }
};

// Initialize permission check when component mounts
onMounted(() => {
  if (props.show) {
    checkCurrentPermission();
  }
});
</script>

<style scoped>
/* Custom animations for the modal */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
