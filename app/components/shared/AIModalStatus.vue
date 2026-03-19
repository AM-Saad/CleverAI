<script setup lang="ts">
import { useAIStore } from '~/composables/ai';
import { motion } from "motion-v";

// Local state
const collapsed = ref(false);

const store = useAIStore('global-ai-store');

// Use the store's modelsList computed (already optimized)
const { modelsList } = store;

// Derived computed values (only recalculate when modelsList changes)
const hasModelInProgress = computed(() =>
  modelsList.value.some(model => model.isDownloading)
);

const activeDownloadsCount = computed(() =>
  modelsList.value.filter(model => model.isDownloading).length
);

const totalModelsCount = computed(() => modelsList.value.length);

// Only show panel if there are models in progress
const showPanel = computed(() => hasModelInProgress.value);

const panelClasses = computed(() => ({
  'max-h-12 overflow-hidden': collapsed.value,
  'max-h-[400px] overflow-auto': !collapsed.value,
}));

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value;
};
</script>
<template>
  <!-- Debug Panel (Fixed Position) -->
  <Transition enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="transform translate-y-full opacity-0" enter-to-class="transform translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in" leave-from-class="transform translate-y-0 opacity-100"
    leave-to-class="transform translate-y-full opacity-0">
    <div v-if="showPanel"
      :class="['ai-models-progress fixed bottom-0 right-4 w-96 max-sm:left-4 max-sm:right-4 max-sm:w-auto  z-[999] transition-all duration-500 ease-in-out shadow-[0_4px_8px_-2px_rgba(0,0,0,0.35)] bg-white/95  backdrop-blur border border-secondary rounded-t-lg ', panelClasses]">

      <div class="text-sm space-y-3">
        <header class="flex items-center justify-between cursor-pointer outline-0 gap-2 bg-surface-strong h-8 px-4 "
          tabIndex="0" @click="toggleCollapsed" aria-label="AI Models Status Panel Header">
          <div class="flex items-center gap-2 justify-between flex-1">
            <ui-subtitle color="content-on-surface-strong" size="xs" class="flex items-center gap-1">
              <!-- <Icon name="heroicons:cloud-arrow-down" class=" " /> -->
              <!-- <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1"
                stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M4.5 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                <g class="arrow-anim">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9.75v6.75" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 16.5l3 3 3-3" />
                </g>
              </svg> -->
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 30 20" stroke-width="1.5"
                stroke="currentColor" class="w-5 relative overflow-hidden pl-0.5">
                <defs>
                  <clipPath id="cloud-clip">
                    <path
                      d="M4.5 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                  </clipPath>
                </defs>
                <!-- Cloud shape -->
                <path stroke-linecap="round" stroke-linejoin="round"
                  d="M4.5 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                <!-- Centered Arrow group: vertical line and chevrons -->
                <g class="arrow-anim" clip-path="url(#cloud-clip)" transform="translate(20,20)">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 10.5v6" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 16.5l1.5 1.5 1.5-1.5" />
                </g>
              </svg>

              AI Models Progress
            </ui-subtitle>
            <ui-paragraph v-if="collapsed" color="content-on-surface-strong" size="xs" weight="light">
              {{ activeDownloadsCount }} downloading, {{ totalModelsCount }} total
            </ui-paragraph>
          </div>
          <Icon :name="collapsed ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
            class="w-4 h-4 text-content-disabled" />
        </header>

        <section v-if="!collapsed" class="space-y-3 text-xs dark:text-light p-4 pt-0 ">
          <div>
            <p class="font-medium mb-2">Status</p>
            <ul class="space-y-1">
              <li>
                Active Downloads: <strong>{{ activeDownloadsCount }}</strong>
              </li>
              <li>
                Total Models: <strong>{{ totalModelsCount }}</strong>
              </li>
            </ul>
          </div>

          <div>
            <p class="font-medium mb-2">Models</p>
            <ul class="space-y-2">
              <li v-for="model in modelsList" :key="model.modelId">
                <div class="flex flex-col gap-1">
                  <p class="font-semibold truncate" :title="model.modelId">
                    {{ model.modelId }}
                  </p>
                  <div class="flex items-center justify-between">
                    <span v-if="model.isDownloading" class="text-blue-500">
                      Downloading {{ Math.round(model.progress) }}%
                    </span>
                    <span v-else-if="model.isReady" class="text-green-500">
                      ✓ Ready
                    </span>
                    <span v-else class="text-gray-500">
                      Not Loaded
                    </span>
                  </div>
                  <!-- Progress bar for downloading models -->
                  <div v-if="model.isDownloading" class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                      :style="{ width: `${model.progress}%` }" />
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  </Transition>
</template>


<style scoped>
/* ===== Reduced Motion ===== */
@media (prefers-reduced-motion: reduce) {


  .ai-models-progress,
  .ai-models-progress .transition-all,
  .ai-models-progress .transition-all * {
    transition: none !important;
  }
}
</style>
<style scoped>
/* .arrow-anim {
  animation: arrow-bounce 2s infinite cubic-bezier(.68, -0.55, .27, 1.55);
}

@keyframes arrow-bounce {

  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(6px);
  }
} */

.arrow-anim {
  animation: arrow-drop-loop 1.8s infinite linear;
}

@keyframes arrow-drop-loop {
  0% {
    transform: translateY(-6px);
    opacity: 0;
  }

  10% {
    opacity: 1;
  }

  60% {
    transform: translateY(12px);
    opacity: 1;
  }

  70% {
    opacity: 0;
  }

  80% {
    opacity: 0;
  }

  100% {
    transform: translateY(-8px);
    opacity: 0;
  }
}
</style>