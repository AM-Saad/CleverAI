<script setup lang="ts">
import { computed } from "vue";

interface Props {
  isFullscreen?: boolean;
  snapEnabled: boolean;
  activeTool: string;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeWidthInput: string;
  strokeWidthMin: number;
  strokeWidthMax: number;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "toggleFullscreen"): void;
  (e: "deleteNote"): void;
  (e: "toggleSnap"): void;
  (e: "focusCanvasHome"): void;
  (e: "selectTool", toolId: string): void;
  (e: "setFillColor", color: string): void;
  (e: "setStrokeColor", color: string): void;
  (e: "update:strokeWidthInput", value: string): void;
  (e: "applyStrokeWidthInput"): void;
  (e: "setBorderStyle", dash?: number[]): void;
  (e: "undo"): void;
  (e: "redo"): void;
  (e: "deleteSelected"): void;
  (e: "duplicateSelection"): void;
}>();

const modeTools = [
  { id: "select", label: "Select", icon: "i-heroicons-cursor-arrow-rays" },
  { id: "hand", label: "Pan/Zoom Camera", icon: "i-heroicons-hand-raised" },
  { id: "text", label: "Text", icon: "i-heroicons-language" },
  { id: "freedraw", label: "Draw", icon: "i-heroicons-pencil" },
];

const shapeTools = [
  { id: "rect", label: "Rectangle", icon: "i-heroicons-stop" },
  { id: "circle", label: "Circle", icon: "i-heroicons-sun" },
  { id: "ellipse", label: "Ellipse", icon: "i-lucide-ellipse" },
  { id: "line", label: "Line", icon: "i-heroicons-minus" },
  { id: "arrow", label: "Arrow", icon: "i-heroicons-arrow-up-right" },
  { id: "star", label: "Star", icon: "i-heroicons-star" },
];

const colorPresets = [
  "transparent", "#1e293b", "#64748b", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];

const borderStyles = [
  { label: "Solid", dash: undefined },
  { label: "Dashed", dash: [10, 5] },
  { label: "Dotted", dash: [2, 4] },
];

const strokeWidthInputModel = computed({
  get: () => props.strokeWidthInput,
  set: (value: string | number) => emit("update:strokeWidthInput", String(value)),
});

const shapeDropdownItems = computed(() => [[
  ...shapeTools.map((tool) => ({
    label: tool.label,
    icon: tool.icon,
    onSelect: () => emit("selectTool", tool.id),
  })),
]]);

const borderStyleItems = computed(() => [[
  ...borderStyles.map((style) => ({
    label: style.label,
    onSelect: () => emit("setBorderStyle", style.dash),
  })),
]]);

const isShapeToolActive = computed(() => shapeTools.some((tool) => tool.id === props.activeTool));
const currentShapeTool = computed(() => shapeTools.find((tool) => tool.id === props.activeTool) ?? shapeTools[0]!);
</script>

<template>
  <SharedNoteToolbar :is-fullscreen="isFullscreen" @toggleFullscreen="emit('toggleFullscreen')"
    @delete="emit('deleteNote')">
    <template #common-actions-prefix>
      <shared-note-toolbar-button title="Toggle Snap Guides" icon="i-lucide-magnet" :active="snapEnabled"
        @click="emit('toggleSnap')" />
      <shared-note-toolbar-button title="Focus Canvas Content" icon="i-lucide-locate-fixed"
        @click="emit('focusCanvasHome')" />
    </template>

    <div class="flex items-center gap-0.5 mr-2">
      <shared-note-toolbar-button v-for="tool in modeTools" :key="tool.id" :title="tool.label"
        :active="activeTool === tool.id" :icon="tool.icon" @click="emit('selectTool', tool.id)" />

      <UDropdownMenu :modal="false" :items="shapeDropdownItems"
        :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
        <shared-note-toolbar-button title="Add Shape" :active="isShapeToolActive" :icon="currentShapeTool.icon">
          <span class="hidden sm:inline">Shapes</span>
          <UIcon name="i-heroicons-chevron-down" class="w-3.5 h-3.5 opacity-60" />
        </shared-note-toolbar-button>
      </UDropdownMenu>
    </div>

    <div class="w-px h-6 bg-secondary shrink-0" />

    <div class="flex items-center gap-1.5">
      <SharedNoteColorPickerButton
        title="Fill Color"
        icon="i-lucide-paint-bucket"
        :icon-only="true"
        :modelValue="fillColor"
        @update:modelValue="val => emit('setFillColor', val)"
      />

      <SharedNoteColorPickerButton
        title="Border Color"
        icon="i-lucide-pen-line"
        :icon-only="true"
        :modelValue="strokeColor"
        @update:modelValue="val => emit('setStrokeColor', val)"
      />

      <UPopover :arrow="true" :modal="false">
        <shared-note-toolbar-button title="Border Thickness">
          <UIcon name="i-lucide-hash" class="w-[18px] h-[18px] shrink-0" />
          <span class="hidden sm:inline">{{ strokeWidth }}</span>
        </shared-note-toolbar-button>
        <template #content>
          <div class="w-40 p-3 space-y-2">
            <ui-label size="sm">Border thickness</ui-label>
            <UInput v-model="strokeWidthInputModel" type="number" size="sm" inputmode="decimal" :min="strokeWidthMin"
              :max="strokeWidthMax" step="0.5" @change="emit('applyStrokeWidthInput')"
              @blur="emit('applyStrokeWidthInput')" @keyup.enter="emit('applyStrokeWidthInput')" />
          </div>
        </template>
      </UPopover>

      <UDropdownMenu :modal="false" :items="borderStyleItems"
        :content="{ align: 'start', side: 'bottom', sideOffset: 4 }">
        <shared-note-toolbar-button title="Border Style" icon="i-lucide-activity" />
      </UDropdownMenu>
    </div>

    <div class="w-px h-6 bg-surface-strong shrink-0" />

    <div class="flex items-center gap-0.5">
      <shared-note-toolbar-button title="Undo" :shortcuts="['meta', 'z']" :disabled="!canUndo"
        icon="i-heroicons-arrow-uturn-left" @click="emit('undo')" />
      <shared-note-toolbar-button title="Redo" :shortcuts="['meta', 'shift', 'z']" :disabled="!canRedo"
        icon="i-heroicons-arrow-uturn-right" @click="emit('redo')" />
      <shared-note-toolbar-button title="Delete selected" :shortcuts="['delete']" variant="danger"
        :disabled="!hasSelection" icon="i-heroicons-trash" @click="emit('deleteSelected')" />
      <shared-note-toolbar-button title="Duplicate" :shortcuts="['meta', 'd']" :disabled="!hasSelection"
        icon="i-heroicons-document-duplicate" @click="emit('duplicateSelection')" />
    </div>
  </SharedNoteToolbar>
</template>