<script setup lang="ts">
import type { IconName } from "#imports";

type DropdownMenuItems = Array<Array<Record<string, unknown>>>;

export type NoteToolbarControl =
  | {
      type: "button";
      id: string;
      title: string;
      icon?: IconName;
      label?: string;
      hideLabelOnMobile?: boolean;
      active?: boolean;
      disabled?: boolean;
      variant?: "default" | "danger" | "primary";
      shortcuts?: string[];
      trailingIcon?: string;
      onSelect: () => void;
    }
  | {
      type: "dropdown";
      id: string;
      title: string;
      icon?: IconName;
      label?: string;
      hideLabelOnMobile?: boolean;
      active?: boolean;
      disabled?: boolean;
      trailingIcon?: string;
      items: DropdownMenuItems;
    }
  | {
      type: "color";
      id: string;
      title: string;
      icon: IconName;
      modelValue: string | undefined | null;
      label?: string;
      iconOnly?: boolean;
      onUpdate: (value: string) => void;
    }
  | {
      type: "number-popover";
      id: string;
      title: string;
      label: string;
      icon?: string;
      valueLabel?: string | number;
      inputValue: string;
      min?: number;
      max?: number;
      step?: number | string;
      onUpdateInput: (value: string) => void;
      onApply: () => void;
    }
  | {
      type: "separator";
      id: string;
      tone?: "default" | "strong";
    };

defineProps<{
  controls: NoteToolbarControl[];
}>();

const dropdownContent = { align: "start" as const, side: "bottom" as const, sideOffset: 4 };

function updateNumberInput(control: Extract<NoteToolbarControl, { type: "number-popover" }>, value: unknown) {
  control.onUpdateInput(String(value));
}
</script>

<template>
  <template v-for="control in controls" :key="control.id">
    <div
      v-if="control.type === 'separator'"
      class="h-6 w-px shrink-0"
      :class="control.tone === 'strong' ? 'bg-surface-strong' : 'bg-secondary'"
    />

    <shared-note-toolbar-button
      v-else-if="control.type === 'button'"
      :title="control.title"
      :label="control.label"
      :hide-label-on-mobile="control.hideLabelOnMobile"
      :active="control.active"
      :disabled="control.disabled"
      :variant="control.variant"
      :shortcuts="control.shortcuts"
      :icon="control.icon"
      @click="control.onSelect"
    >
      <UIcon v-if="control.trailingIcon" :name="control.trailingIcon" class="h-3.5 w-3.5 opacity-60" />
    </shared-note-toolbar-button>

    <UDropdownMenu
      v-else-if="control.type === 'dropdown'"
      :modal="false"
      :items="control.items"
      :content="dropdownContent"
    >
      <shared-note-toolbar-button
        :title="control.title"
        :label="control.label"
        :hide-label-on-mobile="control.hideLabelOnMobile"
        :active="control.active"
        :disabled="control.disabled"
        :icon="control.icon"
      >
        <UIcon v-if="control.trailingIcon" :name="control.trailingIcon" class="h-3.5 w-3.5 opacity-60" />
      </shared-note-toolbar-button>
    </UDropdownMenu>

    <SharedNoteColorPickerButton
      v-else-if="control.type === 'color'"
      :title="control.title"
      :icon="control.icon"
      :icon-only="control.iconOnly"
      :label="control.label"
      :model-value="control.modelValue"
      @update:model-value="control.onUpdate"
    />

    <UPopover v-else-if="control.type === 'number-popover'" :arrow="true" :modal="false">
      <shared-note-toolbar-button :title="control.title">
        <UIcon v-if="control.icon" :name="control.icon" class="h-4.5 w-4.5 shrink-0" />
        <span v-if="control.valueLabel !== undefined" class="hidden sm:inline">{{ control.valueLabel }}</span>
      </shared-note-toolbar-button>
      <template #content>
        <div class="w-40 space-y-2 p-3">
          <ui-label size="sm">{{ control.label }}</ui-label>
          <UInput
            :model-value="control.inputValue"
            type="number"
            size="sm"
            inputmode="decimal"
            :min="control.min"
            :max="control.max"
            :step="control.step"
            @update:model-value="(value: unknown) => updateNumberInput(control, value)"
            @change="control.onApply"
            @blur="control.onApply"
            @keyup.enter="control.onApply"
          />
        </div>
      </template>
    </UPopover>
  </template>
</template>
