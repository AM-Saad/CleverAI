<template>
  <Teleport to="body">
    <!-- use the modal component, pass in the prop -->
    <UiModal v-model:open="showModal" title="Stay on Track with Your Learning" icon="bell"
      description="Get timely reminders when your flashcards are ready for review">

      <template #body>
        <!-- Benefits -->
        <div class="space-y-3 mb-6">
          <div class="flex items-start gap-3">
            <UiIcon name="i-lucide-circle-check" class="w-5 h-5 text-success-text mt-0.5 shrink-0" />
            <div>
              <div class="text-sm font-medium text-content-on-surface-strong dark:text-content-on-surface">
                Perfect Timing
              </div>
              <div class="text-xs text-content-secondary dark:text-content-secondary">
                Get notified exactly when cards are due for optimal memory
                retention
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <UiIcon name="i-lucide-circle-check" class="w-5 h-5 text-success-text mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-content-on-surface-strong dark:text-content-on-surface">
                Customizable Schedule
              </div>
              <div class="text-xs text-content-secondary dark:text-content-secondary">
                Set your preferred time, timezone, and quiet hours
              </div>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <UiIcon name="i-lucide-circle-check" class="w-5 h-5 text-success-text mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-content-on-surface-strong dark:text-content-on-surface">
                Respect Your Time
              </div>
              <div class="text-xs text-content-secondary dark:text-content-secondary">
                Only notified when you have enough cards to make it worthwhile
              </div>
            </div>
          </div>
        </div>

        <!-- Permission Status -->
        <UiPanel v-if="permissionStatus === 'denied'"
          variant="subtle"
          size="sm"
          role="alert"
          class-name="mb-4 border-error/30 bg-error/10">
          <div class="flex items-start gap-2">
            <UiIcon name="i-lucide-triangle-alert" class="w-5 h-5 text-error-text mt-0.5 flex-shrink-0" />
            <div>
              <div class="text-sm font-medium text-error-text">
                Notifications Blocked
              </div>
              <div class="text-xs text-error-text/80 mt-1">
                Please click the lock icon in your browser's address bar and
                allow notifications for this site.
              </div>
            </div>
          </div>
        </UiPanel>

        <!-- Error Message -->
        <UiPanel v-if="error" variant="subtle" size="sm" role="alert" class-name="mb-4 border-error/20 bg-error/10">
          <div class="text-sm text-error-text">
            {{ error }}
          </div>
        </UiPanel>
      </template>
      <!-- Action Buttons -->
      <template #footer>
        <div class="space-y-3">
          <UiButton :loading="isLoading" :disabled="permissionStatus === 'denied'" tone="primary" size="lg" block
            @click="handleEnableNotifications">
            <template v-if="isLoading">
              <UiIcon name="i-lucide-refresh-cw" class="w-4 h-4 animate-spin mr-2" />
              Setting up notifications...
            </template>
            <template v-else>
              <UiIcon name="i-lucide-bell" class="w-4 h-4 mr-2" />
              Enable Smart Notifications
            </template>
          </UiButton>

          <UiButton tone="neutral" variant="ghost" size="lg" block @click="handleMaybeLater">
            Maybe Later
          </UiButton>

          <!-- Don't ask again option -->
          <div class="flex items-center justify-center gap-2 pt-2">
            <UiCheckbox v-model="dontAskAgain" :disabled="isLoading" />
            <label for="dontAskAgain" class="text-xs text-content-secondary dark:text-content-secondary cursor-pointer"
              @click="dontAskAgain = !dontAskAgain">
              Don't ask me again
            </label>
          </div>
        </div>

        <!-- Privacy Note -->
        <UiPanel variant="subtle" size="sm" class-name="mt-4">
          <div class="text-xs text-content-secondary dark:text-content-secondary">
            <UiIcon name="i-lucide-shield-check" class="w-4 h-4 inline mr-1" />
            Your notification preferences are stored locally and can be changed
            anytime in Settings.
          </div>
        </UiPanel>
      </template>
    </UiModal>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useToast } from "#imports";
import { useNotifications } from "../composables/useNotifications";

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
    const enabled = await registerNotification();
    if (!enabled) {
      permissionStatus.value = await checkPermission();
      return;
    }

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
