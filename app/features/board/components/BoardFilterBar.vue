<script setup lang="ts">
import type { UserTag } from "~/shared/utils/user-tag.contract";
import { comparePosition } from "../../../shared/utils/position-key";

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
  Array.from(tagsStore.tags.value.values()).sort(comparePosition),
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
    .filter((t): t is UserTag => t !== null),
);

const createdAfterValue = computed({
  get: () => props.modelValue.createdAfter ?? "",
  set: (value: string | number | null) =>
    patch({ createdAfter: value ? String(value) : null }),
});

const createdBeforeValue = computed({
  get: () => props.modelValue.createdBefore ?? "",
  set: (value: string | number | null) =>
    patch({ createdBefore: value ? String(value) : null }),
});

const DUE_DATE_OPTIONS: Array<{
  label: string;
  value: BoardFilterState["dueDate"];
  icon: string;
}> = [
  { label: "Any", value: "any", icon: "i-lucide-minus" },
  {
    label: "Overdue",
    value: "overdue",
    icon: "i-lucide-triangle-alert",
  },
  { label: "Today", value: "today", icon: "i-lucide-sun" },
  { label: "This week", value: "this-week", icon: "i-lucide-calendar-days" },
  { label: "Has date", value: "has-date", icon: "i-lucide-clock" },
];
</script>

<template>
  <UiPopover v-model:open="isOpen">
    <!-- Trigger button -->
    <UiButton
      size="xs"
      :icon="activeCount > 0 ? 'i-lucide-list-filter' : 'i-lucide-list-filter'"
      trailing-icon="i-lucide-chevron-down"
      :tone="activeCount > 0 ? 'primary' : 'neutral'"
      :variant="activeCount > 0 ? 'soft' : 'ghost'"
    >
      <span v-if="activeCount === 0">Filters</span>
      <span v-else
        >{{ activeCount }} filter{{ activeCount === 1 ? "" : "s" }}</span
      >
    </UiButton>

    <template #content>
      <div class="w-80 space-y-4 p-3">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <span
            class="text-xs font-bold uppercase tracking-widest text-content-secondary"
            >Filters</span
          >
          <UiButton
            v-if="activeCount > 0"
            size="xs"
            tone="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="clearAll"
          >
            Clear all
          </UiButton>
        </div>

        <!-- ── Tags ──────────────────────────────────────────────────── -->
        <UiPanel
          tag="div"
          size="sm"
          variant="surface"
          content-class="flex flex-col gap-4"
        >
          <div>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-content-secondary mb-2"
            >
              Tags
            </p>

            <div
              v-if="allTags.length > 0"
              class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1"
            >
              <UiButton
                v-for="tag in allTags"
                :key="tag.id"
                size="xs"
                tone="neutral"
                :variant="
                  modelValue.tags.includes(tag.name) ? 'solid' : 'soft'
                "
                class="rounded-full"
                :class="
                  modelValue.tags.includes(tag.name)
                    ? 'shadow-[var(--shadow-dropdown)]'
                    : ''
                "
                :style="
                  modelValue.tags.includes(tag.name)
                    ? {
                        backgroundColor: tag.color,
                        color: 'var(--color-on-primary)',
                        borderColor: tag.color,
                      }
                    : {}
                "
                @click="toggleTag(tag.name)"
              >
                <Icon
                  v-if="modelValue.tags.includes(tag.name)"
                  name="i-lucide-check"
                  class="w-3 h-3"
                />
                {{ tag.name }}
              </UiButton>
            </div>

            <p v-else class="text-xs text-content-secondary italic py-2">
              No tags created yet
            </p>
          </div>
          <!-- ── Due Date ───────────────────────────────────────────────── -->
          <div>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-content-secondary mb-2"
            >
              Due Date
            </p>
            <div class="flex min-w-full overflow-x-auto gap-1.5">
              <UiButton
                v-for="opt in DUE_DATE_OPTIONS"
                :key="opt.value"
                size="xs"
                :tone="modelValue.dueDate === opt.value ? 'primary' : 'neutral'"
                :variant="
                  modelValue.dueDate === opt.value ? 'solid' : 'soft'
                "
                :icon="opt.icon"
                class="min-w-fit rounded-full"
                @click="patch({ dueDate: opt.value })"
              >
                {{ opt.label }}
              </UiButton>
            </div>
          </div>

          <!-- ── Created At ─────────────────────────────────────────────── -->
          <div>
            <p
              class="text-[10px] font-bold uppercase tracking-widest text-content-secondary mb-2"
            >
              Created
            </p>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] text-content-secondary mb-1 block"
                  >From</label
                >
                <UiInput v-model="createdAfterValue" type="date" size="xs" />
              </div>
              <div>
                <label class="text-[10px] text-content-secondary mb-1 block"
                  >To</label
                >
                <UiInput v-model="createdBeforeValue" type="date" size="xs" />
              </div>
            </div>
          </div>
        </UiPanel>

        <!-- ── Active filter chips ───────────────────────────────────── -->
        <div
          v-if="activeCount > 0"
          class="pt-2 border-t border-secondary flex flex-wrap gap-1.5"
        >
          <span
            v-for="tag in selectedTagObjects.slice(0, 4)"
            :key="tag.id"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium text-white"
            :style="{ backgroundColor: tag.color }"
          >
            {{ tag.name }}
            <UiIconButton
              icon="i-lucide-x"
              :label="`Remove ${tag.name} filter`"
              size="xs"
              variant="ghost"
              class="h-3 w-3 min-h-3 min-w-3 text-white hover:opacity-70"
              @click="toggleTag(tag.name)"
            />
          </span>
          <span
            v-if="selectedTagObjects.length > 4"
            class="text-[10px] text-content-secondary self-center"
          >
            +{{ selectedTagObjects.length - 4 }} more
          </span>
          <span
            v-if="modelValue.dueDate !== 'any'"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary"
          >
            {{
              DUE_DATE_OPTIONS.find((o) => o.value === modelValue.dueDate)
                ?.label
            }}
            <UiIconButton
              icon="i-lucide-x"
              label="Clear due date filter"
              size="xs"
              variant="ghost"
              class="h-3 w-3 min-h-3 min-w-3 hover:opacity-70"
              @click="patch({ dueDate: 'any' })"
            />
          </span>
          <span
            v-if="modelValue.createdAfter || modelValue.createdBefore"
            class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-content-on-surface"
          >
            Created: {{ modelValue.createdAfter ?? "–" }} →
            {{ modelValue.createdBefore ?? "now" }}
            <UiIconButton
              icon="i-lucide-x"
              label="Clear created date filter"
              size="xs"
              variant="ghost"
              class="h-3 w-3 min-h-3 min-w-3 hover:opacity-70"
              @click="patch({ createdAfter: null, createdBefore: null })"
            />
          </span>
        </div>
      </div>
    </template>
  </UiPopover>
</template>
