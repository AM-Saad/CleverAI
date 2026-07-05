<template>
  <component
    :is="tag"
    :id="id || undefined"
    :class="ui.root({ class: className })"
  >
    <div v-if="$slots.header || title || description" :class="ui.header()">
      <slot name="header">
        <span v-if="title" :class="ui.title()">{{ title }}</span>
        <span v-if="description" :class="ui.description()">{{
          description
        }}</span>
      </slot>
    </div>

    <div :class="ui.body({ class: bodyClass })">
      <slot />
    </div>

    <div v-if="$slots.footer" :class="ui.footer()">
      <slot name="footer" />
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * UiSettingsGroup - grouped settings surface with automatic row dividers.
 */
import { computed } from "vue";
import { tv } from "./variants";

const props = withDefaults(
  defineProps<{
    id?: string;
    tag?: "section" | "div" | "article";
    title?: string;
    description?: string;
    variant?: "card" | "soft";
    className?: string;
    bodyClass?: string;
  }>(),
  {
    id: "",
    tag: "section",
    title: "",
    description: "",
    variant: "card",
    className: "",
    bodyClass: "",
  },
);

const group = tv({
  slots: {
    root: "ui-settings-group scroll-mt-4",
    header: "mb-2 flex min-w-0 flex-col gap-0.5 px-1",
    title:
      "text-[11px] font-bold uppercase tracking-[1.5px] text-content-secondary",
    description: "text-xs text-content-secondary",
    body: "ui-settings-group__body overflow-hidden rounded-[var(--radius-2xl)] border",
    footer: "mt-3",
  },
  variants: {
    variant: {
      card: {
        body: "border-secondary bg-[var(--ds-surface-card)] shadow-[var(--shadow-card)]",
      },
      soft: {
        body: "border-secondary bg-surface-subtle",
      },
    },
  },
});

const ui = computed(() => group({ variant: props.variant }));
</script>

<style scoped>
.ui-settings-group__body :deep(.ui-settings-row + .ui-settings-row) {
  border-top: 1px solid var(--color-secondary);
}
</style>
