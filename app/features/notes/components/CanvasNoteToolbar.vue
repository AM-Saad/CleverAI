<script setup lang="ts">
import type { IconName } from "#imports";
import type { NoteToolbarControl } from "~/components/shared/NoteToolbarControls.vue";
import { computed } from "vue";
import { designTokenValues } from "~/design-system/tokens.generated";

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
  readonly?: boolean;
}

type Tool = {
  id: string;
  label: string;
  icon: IconName;
  menuIcon?: string;
};

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

const modeTools: Tool[] = [
  { id: "select", label: "Select", icon: "cursor-arrow-rays" },
  { id: "hand", label: "Pan/Zoom Camera", icon: "hand" },
  { id: "text", label: "Text", icon: "text-icon" },
  { id: "freedraw", label: "Draw", icon: "pencil" },
];

const shapeTools: Tool[] = [
  { id: "rect", label: "Rectangle", icon: "stop", menuIcon: "i-lucide-square" },
  { id: "circle", label: "Circle", icon: "sun", menuIcon: "i-lucide-circle" },
  { id: "ellipse", label: "Ellipse", icon: "ellipse", menuIcon: "i-lucide-ellipse" },
  { id: "line", label: "Line", icon: "minus", menuIcon: "i-lucide-minus" },
  { id: "arrow", label: "Arrow", icon: "arrow-up-right", menuIcon: "i-lucide-arrow-up-right" },
  { id: "star", label: "Star", icon: "star", menuIcon: "i-lucide-star" },
];

// Swatch paint colors resolved from design tokens (canvas needs literal color
// strings, not CSS custom properties). Colors snap to the reconciled tokens.
const colorPresets = [
  "transparent",
  designTokenValues["--color-content-on-background"],
  designTokenValues["--color-content-secondary"],
  designTokenValues["--color-error"],
  designTokenValues["--color-accent-orange"],
  designTokenValues["--color-warning"],
  designTokenValues["--color-success"],
  designTokenValues["--color-accent-blue"],
  designTokenValues["--color-accent-purple"],
  designTokenValues["--color-accent-pink"],
  designTokenValues["--color-white"],
];

const borderStyles = [
  { label: "Solid", dash: undefined },
  { label: "Dashed", dash: [10, 5] },
  { label: "Dotted", dash: [2, 4] },
];

const shapeDropdownItems = computed(() => [[
  ...shapeTools.map((tool) => ({
    label: tool.label,
    icon: tool.menuIcon,
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

const toolControls = computed<NoteToolbarControl[]>(() => [
  ...modeTools.map((tool) => ({
    type: "button" as const,
    id: `tool-${tool.id}`,
    title: tool.label,
    active: props.activeTool === tool.id,
    icon: tool.icon,
    onSelect: () => emit("selectTool", tool.id),
  })),
  {
    type: "dropdown",
    id: "shape-tools",
    title: "Add Shape",
    label: "Shapes",
    hideLabelOnMobile: true,
    active: isShapeToolActive.value,
    icon: currentShapeTool.value.icon,
    trailingIcon: "i-lucide-chevron-down",
    items: shapeDropdownItems.value,
  },
]);

const styleControls = computed<NoteToolbarControl[]>(() => [
  {
    type: "color",
    id: "fill-color",
    title: "Fill Color",
    icon: "color-bucket",
    iconOnly: true,
    modelValue: props.fillColor,
    onUpdate: (value) => emit("setFillColor", value),
  },
  {
    type: "color",
    id: "border-color",
    title: "Border Color",
    icon: "edit",
    iconOnly: true,
    modelValue: props.strokeColor,
    onUpdate: (value) => emit("setStrokeColor", value),
  },
  {
    type: "number-popover",
    id: "border-thickness",
    title: "Border Thickness",
    label: "Border thickness",
    icon: "i-lucide-hash",
    valueLabel: props.strokeWidth,
    inputValue: props.strokeWidthInput,
    min: props.strokeWidthMin,
    max: props.strokeWidthMax,
    step: 0.5,
    onUpdateInput: (value) => emit("update:strokeWidthInput", value),
    onApply: () => emit("applyStrokeWidthInput"),
  },
  {
    type: "dropdown",
    id: "border-style",
    title: "Border Style",
    icon: "activity",
    items: borderStyleItems.value,
  },
]);

const editControls = computed<NoteToolbarControl[]>(() => [
  {
    type: "button",
    id: "undo",
    title: "Undo",
    shortcuts: ["meta", "z"],
    disabled: !props.canUndo,
    icon: "undo",
    onSelect: () => emit("undo"),
  },
  {
    type: "button",
    id: "redo",
    title: "Redo",
    shortcuts: ["meta", "shift", "z"],
    disabled: !props.canRedo,
    icon: "redo",
    onSelect: () => emit("redo"),
  },
  {
    type: "button",
    id: "delete-selected",
    title: "Delete selected",
    shortcuts: ["delete"],
    variant: "danger",
    disabled: !props.hasSelection,
    icon: "delete",
    onSelect: () => emit("deleteSelected"),
  },
  {
    type: "button",
    id: "duplicate-selection",
    title: "Duplicate",
    shortcuts: ["meta", "d"],
    disabled: !props.hasSelection,
    icon: "duplicate",
    onSelect: () => emit("duplicateSelection"),
  },
]);
</script>

<template>
  <SharedNoteToolbar :is-fullscreen="isFullscreen" :readonly="readonly" @toggleFullscreen="emit('toggleFullscreen')"
    @delete="emit('deleteNote')">
    <template #common-actions-prefix>
      <shared-note-toolbar-button title="Toggle Snap Guides" icon="magnet" :active="snapEnabled"
        @click="emit('toggleSnap')" />
      <shared-note-toolbar-button title="Focus Canvas Content" icon="focus" @click="emit('focusCanvasHome')" />
    </template>

    <div class="flex items-center gap-0.5 mr-2">
      <SharedNoteToolbarControls :controls="toolControls" />
    </div>

    <div class="w-px h-6 bg-secondary shrink-0" />

    <div class="flex items-center gap-1.5">
      <SharedNoteToolbarControls :controls="styleControls" />
    </div>

    <div class="w-px h-6 bg-surface-strong shrink-0" />

    <div class="flex items-center gap-0.5">
      <SharedNoteToolbarControls :controls="editControls" />
    </div>
  </SharedNoteToolbar>
</template>
