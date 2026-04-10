<script setup lang="ts">
import { useUserTagsStore } from "~/composables/tags/useUserTagsStore";
import type { UserTag } from "~/shared/utils/user-tag.contract";

export interface BoardFilterState {
  tags: string[];
  /** Preset due-date filter */
  dueDate: "any" | "overdue" | "today" | "this-week" | "has-date";
  createdAfter: string | null;
  createdBefore: string | null;
}

const props = defineProps<{
  modelValue: BoardFilterState;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: BoardFilterState];
}>();

const route = useRoute();
const id = route.params.id;
const tagsStore = useUserTagsStore(id as string);
const isOpen = ref(false);

onMounted(() => {
  if (tagsStore.tags.value.size === 0) tagsStore.loadTags();
});

const allTags = computed(() =>
  Array.from(tagsStore.tags.value.values()).sort((a, b) => a.order - b.order)
);

// ── helpers ─────────────────────────────────────────────────────────────────

function patch(partial: Partial<BoardFilterState>) {
  emit("update:modelValue", { ...props.modelValue, ...partial });
}

function toggleTag(name: string) {
  const tags = props.modelValue.tags.includes(name)
    ? props.modelValue.tags.filter((t) => t !== name)
    : [...props.modelValue.tags, name];
  patch({ tags });
}

function clearAll() {
  emit("update:modelValue", {
    tags: [],
    dueDate: "any",
    createdAfter: null,
    createdBefore: null,
  });
}

// ── derived state ────────────────────────────────────────────────────────────

const activeCount = computed(() => {
  let n = props.modelValue.tags.length;
  if (props.modelValue.dueDate !== "any") n++;
  if (props.modelValue.createdAfter || props.modelValue.createdBefore) n++;
  return n;
});

const selectedTagObjects = computed<UserTag[]>(() =>
  props.modelValue.tags
    .map((name) => tagsStore.getTagByName(name))
    .filter((t): t is UserTag => t !== null)
);

const DUE_DATE_OPTIONS: Array<{ label: string; value: BoardFilterState["dueDate"]; icon: string }> = [
  { label: "Any", value: "any", icon: "heroicons:minus" },
  { label: "Overdue", value: "overdue", icon: "heroicons:exclamation-triangle" },
  { label: "Today", value: "today", icon: "heroicons:sun" },
  { label: "This week", value: "this-week", icon: "heroicons:calendar-days" },
  { label: "Has date", value: "has-date", icon: "heroicons:clock" },
];
</script>

<template>
  <UPopover v-model:open="isOpen">
    <!-- Trigger button -->
    <UButton
      size="sm"
      :icon="activeCount > 0 ? 'heroicons:funnel-solid' : 'heroicons:funnel'"
      trailing-icon="heroicons:chevron-down-20-solid"
      :color="activeCount > 0 ? 'primary' : 'neutral'"
      :variant="activeCount > 0 ? 'soft' : 'ghost'"
    >
      <span v-if="activeCount === 0">Filters</span>
      <span v-else>{{ activeCount }} filter{{ activeCount === 1 ? "" : "s" }}</span>
    </UButton>

    <template #content>
      <div class="w-80 p-3 space-y-4">

        <!-- Header -->
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Filters</span>
          <UButton v-if="activeCount > 0" size="xs" color="neutral" variant="ghost" icon="heroicons:x-mark"
            @click="clearAll">
            Clear all
          </UButton>
        </div>

        <!-- ── Tags ──────────────────────────────────────────────────── -->
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Tags</p>

          <div v-if="allTags.length > 0" class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
            <button
              v-for="tag in allTags"
              :key="tag.id"
              type="button"
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                modelValue.tags.includes(tag.name)
                  ? 'border-transparent shadow-sm scale-105'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300'
              ]"
              :style="modelValue.tags.includes(tag.name)
                ? { backgroundColor: tag.color, color: '#fff' }
                : {}"
              @click="toggleTag(tag.name)"
            >
              <Icon
                v-if="modelValue.tags.includes(tag.name)"
                name="heroicons:check-20-solid"
                class="w-3 h-3"
              />
              {{ tag.name }}
            </button>
          </div>

          <p v-else class="text-xs text-gray-400 italic py-2">No tags created yet</p>
        </div>

        <!-- ── Due Date ───────────────────────────────────────────────── -->
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Due Date</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="opt in DUE_DATE_OPTIONS"
              :key="opt.value"
              type="button"
              :class="[
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                modelValue.dueDate === opt.value
                  ? 'bg-primary-500 text-white border-primary-600 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300',
              ]"
              @click="patch({ dueDate: opt.value })"
            >
              <Icon :name="opt.icon" class="w-3 h-3" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- ── Created At ─────────────────────────────────────────────── -->
        <div>
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Created</p>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-gray-400 mb-1 block">From</label>
              <input
                type="date"
                :value="modelValue.createdAfter ?? ''"
                class="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                @input="patch({ createdAfter: ($event.target as HTMLInputElement).value || null })"
              />
            </div>
            <div>
              <label class="text-[10px] text-gray-400 mb-1 block">To</label>
              <input
                type="date"
                :value="modelValue.createdBefore ?? ''"
                class="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                @input="patch({ createdBefore: ($event.target as HTMLInputElement).value || null })"
              />
            </div>
          </div>
        </div>

        <!-- ── Active filter chips ───────────────────────────────────── -->
        <div v-if="activeCount > 0" class="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5">
          <span
            v-for="tag in selectedTagObjects.slice(0, 4)"
            :key="tag.id"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
            :style="{ backgroundColor: tag.color }"
          >
            {{ tag.name }}
            <button type="button" class="hover:opacity-70" @click="toggleTag(tag.name)">
              <Icon name="heroicons:x-mark-20-solid" class="w-3 h-3" />
            </button>
          </span>
          <span v-if="selectedTagObjects.length > 4" class="text-[10px] text-gray-400 self-center">
            +{{ selectedTagObjects.length - 4 }} more
          </span>
          <span
            v-if="modelValue.dueDate !== 'any'"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400"
          >
            {{ DUE_DATE_OPTIONS.find((o) => o.value === modelValue.dueDate)?.label }}
            <button type="button" class="hover:opacity-70" @click="patch({ dueDate: 'any' })">
              <Icon name="heroicons:x-mark-20-solid" class="w-3 h-3" />
            </button>
          </span>
          <span
            v-if="modelValue.createdAfter || modelValue.createdBefore"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            Created: {{ modelValue.createdAfter ?? "–" }} → {{ modelValue.createdBefore ?? "now" }}
            <button type="button" class="hover:opacity-70" @click="patch({ createdAfter: null, createdBefore: null })">
              <Icon name="heroicons:x-mark-20-solid" class="w-3 h-3" />
            </button>
          </span>
        </div>
      </div>
    </template>
  </UPopover>
</template>
