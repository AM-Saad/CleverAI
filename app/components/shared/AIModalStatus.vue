<script setup lang="ts">
import { useAIStore } from '~/composables/ai';

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
      :class="['fixed bottom-4 right-4 w-80 max-sm:left-4 max-sm:right-4 max-sm:w-auto max-sm:bottom-2 z-[999] transition-all duration-300 ease-in-out hover:bottom-5 ', panelClasses]">

      <div
        class="bg-white/95 dark:bg-gray-900/95 backdrop-blur border dark:border-primary rounded-lg p-4 text-sm space-y-3 shadow-[0_4px_18px_-2px_rgba(0,0,0,0.15)]">
        <header class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold dark:text-light flex items-center gap-2">
              <Icon name="heroicons:cloud-arrow-down" class="w-4 h-4 text-blue-500" />
              AI Models Progress
            </h3>
            <span v-if="collapsed" class="text-xs text-gray-500">
              {{ activeDownloadsCount }} downloading, {{ totalModelsCount }} total
            </span>
          </div>
          <button class="text-gray-500 hover:text-gray-700 cursor-pointer" aria-label="Toggle Panel"
            @click="toggleCollapsed">
            <Icon :name="collapsed ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-4 h-4" />
          </button>
        </header>

        <section v-if="!collapsed" class="space-y-3 text-xs dark:text-light">
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

        <footer class="flex items-center justify-between pt-2 border-t text-xs text-gray-500">
          <button @click="toggleCollapsed" class="underline hover:text-gray-700 dark:hover:text-gray-300">
            {{ collapsed ? "Expand" : "Collapse" }}
          </button>
        </footer>
      </div>
    </div>
  </Transition>
</template>