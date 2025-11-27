<template>
  <div class="materials-list">
    <ui-loader :is-fetching="loading" label="Loading Materials..." />

    <shared-server-error :loading="loading" v-model:typedError="error" />

    <!-- Fullscreen backdrop with transition -->
    <Transition name="backdrop">
      <div v-if="fullscreenMaterial" class="fullscreen-backdrop" @click="closeFullscreen" />
    </Transition>


    <ul v-if="!loading && materials.length > 0">


      <ui-card v-for="m in materials" :key="m.id" tag="article"
        :variant="fullscreenMaterial === m.id ? 'default' : 'ghost'" size="xs" :class="{
          'fullscreen-card bg-light': fullscreenMaterial === m.id,
          'relative z-50': fullscreenMaterial === m.id,
        }">


        <!-- Sticky header for fullscreen -->
        <header v-if="fullscreenMaterial === m.id" class="fullscreen-header">

          <div class="flex w-full justify-between items-center gap-2 flex-wrap">

            <ui-subtitle >{{ m.title }}</ui-subtitle>

            <div class="flex shrink-0 gap-2">
              <!-- Fullscreen/Expand button -->
              <u-button variant="ghost" @click="() => toggleFullscreen(m.id)">
                <Icon name="ic:round-fullscreen-exit" size="16" />
              </u-button>
              <!-- Enrollment button -->
              <ReviewEnrollButton :resource-type="'material'" :resource-id="m.id"
                :is-enrolled="enrolledMaterials.has(m.id)" @enrolled="handleMaterialEnrolled"
                @error="handleEnrollError" />
              <u-button color="error" variant="outline" size="xs" @click="() => confirmRemoval(m.id)">
                Remove</u-button>
            </div>

          </div>

          <span v-if="enrolledMaterials.has(m.id)"
            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mt-2">
            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
            </svg>
            Enrolled
          </span>

        </header>


        <!-- Regular card layout (non-fullscreen) -->
        <div v-else class="flex-1">

          <div class="flex items-center">

            <header class="flex w-full justify-between items-center gap-2">
              <ui-subtitle weight="normal" size="sm">{{ m.title }}</ui-subtitle>
              <div class="ml-4 flex-shrink-0 flex gap-2">
                <!-- Fullscreen/Expand button -->
                <u-button variant="ghost" @click="() => toggleFullscreen(m.id)">
                  <Icon name="ic:round-fullscreen" size="16" />
                </u-button>
              </div>
            </header>

            <span v-if="enrolledMaterials.has(m.id)"
              class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clip-rule="evenodd" />
              </svg>
              Enrolled
            </span>

          </div>


          <div>

            <!-- Regular content (non-fullscreen) -->
            <transition name="fade-slide">
              <div v-if="expandedMaterials.has(m.id)" class="h-48 overflow-auto">
                <ui-card tag="article" class="mt-4" variant="ghost">
                  <ui-paragraph class="whitespace-pre-wrap">{{ m.content }}</ui-paragraph>
                </ui-card>
              </div>
            </transition>

          </div>
        </div>

        <!-- Fullscreen scrollable content -->
        <div v-if="fullscreenMaterial === m.id" class="fullscreen-content">

          <div class="fullscreen-content-inner">
            <ui-card tag="article" variant="ghost">
              <ui-paragraph class="whitespace-pre-wrap">{{ m.content }}</ui-paragraph>
            </ui-card>
          </div>

        </div>

      </ui-card>

    </ul>

    <ui-paragraph v-if="!loading && materials.length === 0 && !error" color="muted">
      No materials in this folder.
    </ui-paragraph>
  </div>

  <!-- Confirmation Modal -->
  <DialogModal :show="showConfirm" @close="
    () => {
      showConfirm = false;
      confirmId = null;
    }
  ">
    <template #header>
      <div class="flex items-center gap-1">
        <icon name="ic:round-delete" class="text-error" />
        Confirm Delete
      </div>
    </template>
    <template #body>
      <ui-paragraph size="sm" color="muted">
        Are you sure you want to delete this material? This action cannot be
        undone.
      </ui-paragraph>
    </template>
    <template #footer>
      <div class="flex gap-3 pt-4">
        <u-button type="submit" color="error" @click="doConfirmRemove">
          Delete
          <svg v-if="loading" class="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </u-button>
        <u-button type="button" variant="subtle" @click="() => {
          showConfirm = false;
          confirmId = null;
        }">Cancel</u-button>
      </div>
    </template>
  </DialogModal>
</template>

<script setup lang="ts">
import DialogModal from "~/components/shared/DialogModal.vue";

// Track expanded/collapsed state for each material
const expandedMaterials = ref(new Set<string>());
// Track fullscreen state with transition control
const fullscreenMaterial = ref<string | null>(null);
const isTransitioning = ref(false);

async function toggleFullscreen(id: string) {
  if (isTransitioning.value) return; // Prevent multiple clicks during transition

  isTransitioning.value = true;

  if (fullscreenMaterial.value === id) {
    // Closing fullscreen
    fullscreenMaterial.value = null;
    // Wait for exit animation to complete
    setTimeout(() => {
      isTransitioning.value = false;
    }, 350); // Match CSS transition timing
  } else {
    // Opening fullscreen - set state immediately to prevent content flash
    fullscreenMaterial.value = id;
    // Wait for enter animation to complete
    setTimeout(() => {
      isTransitioning.value = false;
    }, 350);
  }
}

function closeFullscreen() {
  if (isTransitioning.value) return;

  isTransitioning.value = true;
  fullscreenMaterial.value = null;
  setTimeout(() => {
    isTransitioning.value = false;
  }, 350);
}

// Close fullscreen on ESC key
onMounted(() => {
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && fullscreenMaterial.value) {
      closeFullscreen();
    }
  };
  document.addEventListener("keydown", handleEscape);
  // Cleanup
  onUnmounted(() => {
    document.removeEventListener("keydown", handleEscape);
  });
});

const props = defineProps<{ folderId: string }>();
const emit = defineEmits<{
  removed: [id: string];
  error: [err: string];
}>();
const route = useRoute();
const id = route.params.id;

// Centralized error handling - all errors come from FetchFactory
// const {
//   materials,
//   loading,
//   error,
//   removing,
//   removeTypedError,
//   removeMaterial,
// } = useMaterials(props.folderId);

// const materialList = computed(() => materials.value ?? []);

const {
  materials: materialList,
  fetching: loading,
  fetchTypedError: error,
  deleteMaterial
} = useMaterialsStore(id as string);
// Track enrolled materials
const enrolledMaterials = ref(new Set<string>());

const materials = computed(() => {
  return Array.from(materialList.value.values());
});

// Check enrollment status when materials are available
watch(
  materials,
  async (mats) => {
    if (mats && mats.length > 0) {
      await checkEnrollmentStatus();
    }
  },
  { immediate: true },
);

async function checkEnrollmentStatus() {
  const materialIds = materials.value.map((m) => m.id);
  if (materialIds.length === 0) return;

  try {
    const { $api } = useNuxtApp();
    const result = await $api.review.getEnrollmentStatus(
      materialIds,
      "material",
    );

    if (
      result &&
      result.success &&
      result.data &&
      result.data.enrollments &&
      typeof result.data.enrollments === "object"
    ) {
      // Update enrolled materials Set
      enrolledMaterials.value.clear();
      Object.entries(result.data.enrollments).forEach(
        ([materialId, isEnrolled]) => {
          if (isEnrolled) {
            enrolledMaterials.value.add(materialId);
          }
        },
      );
    } else {
      const errorMessage =
        result && !result.success && "error" in result
          ? result.error?.message
          : "Unknown error";
      console.error("Failed to check enrollment status:", errorMessage);
    }
  } catch (error) {
    console.error("Failed to check enrollment status:", error);
  }
}

function handleMaterialEnrolled(response: EnrollCardResponse) {
  if (response.success) {
    // Refresh enrollment status to be sure
    checkEnrollmentStatus();
    console.log("Material enrolled successfully:", response.cardId);
  }
}

function handleEnrollError(error: string) {
  console.error("Failed to enroll material:", error);
  emit("error", error);
}

const showConfirm = ref(false);
const confirmId = ref<string | null>(null);

const confirmRemoval = (id: string) => {
  confirmId.value = id;
  showConfirm.value = true;
};

const doConfirmRemove = async () => {
  if (!confirmId.value) return;

  showConfirm.value = false;
  closeFullscreen();
  emit("removed", confirmId.value);
  const result = await deleteMaterial(confirmId.value);
  confirmId.value = null;

  if (result) {
    // Success - result is not null
  } else if (error.value) {
    // Error occurred - use centralized error details
    emit("error", error.value.message);
  }


};
</script>

<style scoped>
.materials-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

/* Backdrop transitions */
.backdrop-enter-active,
.backdrop-leave-active {
  transition: all 0.3s ease-out;
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

.backdrop-enter-to,
.backdrop-leave-from {
  opacity: 1;
  backdrop-filter: blur(4px);
}

/* Fullscreen backdrop */
.fullscreen-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 40;
  backdrop-filter: blur(4px);
}

/* Enhanced fullscreen card styles with explicit height layout */
.fullscreen-card {
  position: fixed !important;
  top: 50%;
  left: 50%;
  width: 90vw !important;
  height: 85vh !important;
  max-width: 1200px !important;
  max-height: 800px !important;
  z-index: 50 !important;
  overflow: hidden !important;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;

  /* Smooth transform and opacity transitions */
  transform: translate(-50%, -50%) scale(1) !important;
  opacity: 1;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  /* Entry animation */
  animation: expandToFullscreen 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

/* Sticky header for fullscreen */
.fullscreen-header {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  z-index: 10 !important;
  background: inherit !important;
  padding: 1.5rem 1.5rem 1rem 1.5rem !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
  backdrop-filter: blur(8px) !important;
  height: auto !important;
}

/* Fullscreen content area - with explicit positioning */
.fullscreen-content {
  position: absolute !important;
  top: 100px !important;
  /* Adjust based on header height */
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 0 1.5rem 1.5rem 1.5rem !important;
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

/* Dark mode adjustments for header */
@media (prefers-color-scheme: dark) {
  .fullscreen-header {
    border-bottom-color: rgba(75, 85, 99, 0.3) !important;
    background: rgba(17, 24, 39, 0.95) !important;
  }
}

/* Remove the inner wrapper as it's not needed with absolute positioning */
.fullscreen-content-inner {
  width: 100% !important;
}

/* Ensure ui-card doesn't interfere with scrolling */
.fullscreen-content :deep(.ui-card) {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

/* Ensure paragraph content flows naturally */
.fullscreen-content :deep(.ui-paragraph) {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  word-wrap: break-word !important;
  white-space: pre-wrap !important;
}

.fullscreen-content::-webkit-scrollbar {
  width: 6px;
}

.fullscreen-content::-webkit-scrollbar-track {
  background: transparent;
}

.fullscreen-content::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 3px;
  transition: background-color 0.2s ease;
}

.fullscreen-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Enhanced transition for material content */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Simplified and cleaner animations for fullscreen transitions */
@keyframes expandToFullscreen {
  0% {
    transform: translate(-50%, -50%) scale(0.9);
    opacity: 0;
  }

  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

/* Button transition improvements */
.materials-list button {
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.materials-list button:hover {
  transform: translateY(-1px);
}

.materials-list button:active {
  transform: translateY(0);
}

/* Dark mode adjustments for fullscreen */
@media (prefers-color-scheme: dark) {
  .fullscreen-card {
    background: rgb(17, 24, 39) !important;
    border-color: rgba(75, 85, 99, 0.3) !important;
  }
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .fullscreen-card {
    width: 95vw !important;
    height: 90vh !important;
    border-radius: 8px !important;
  }

  .fullscreen-header {
    padding: 1rem 1rem 0.75rem 1rem !important;
  }

  .fullscreen-content {
    top: 80px !important;
    /* Smaller top offset for mobile */
    padding: 0 1rem 1rem 1rem !important;
  }
}

/* Performance optimizations */
.fullscreen-card {
  will-change: transform, opacity;
  backface-visibility: hidden;
  perspective: 1000px;
}

.fullscreen-backdrop {
  will-change: opacity, backdrop-filter;
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {

  .fullscreen-card,
  .fullscreen-backdrop,
  .fade-slide-enter-active,
  .fade-slide-leave-active,
  .backdrop-enter-active,
  .backdrop-leave-active,
  .materials-list button {
    transition: none !important;
    animation: none !important;
  }

  .fullscreen-card {
    transform: translate(-50%, -50%) !important;
    opacity: 1 !important;
    filter: none !important;
  }
}
</style>
