<template>
  <header :class="['max-w-full min-w-0', borderClass]">
    <nav
      :class="['flex min-w-0 overflow-x-auto', directionClass]"
      role="tablist"
      :aria-label="ariaLabel"
      :aria-orientation="resolvedOrientation"
    >
      <button
        v-for="(tab, index) in items"
        :id="tabId(index)"
        :key="tabKey(tab, index)"
        type="button"
        role="tab"
        :aria-selected="activeIndexLocal === index"
        :aria-controls="panelId(index)"
        :aria-disabled="tab.disabled || undefined"
        :disabled="tab.disabled"
        :tabindex="activeIndexLocal === index ? 0 : -1"
        :class="[
          'cursor-pointer outline-none',
          interactiveTransition,
          focusRing,
          buttonBaseClass,
          activeIndexLocal === index ? activeClass : inactiveClass,
          tab.disabled && disabledState,
        ]"
        @click="onSelect(index)"
        @keydown="onTabKeydown(index, $event)"
      >
        <Icon v-if="tab.icon && isIconifyIcon(tab.icon)" :name="tab.icon" class="h-4 w-4" aria-hidden="true" />
        <shared-icon v-else-if="tab.icon" :name="tab.icon as IconName" :size="UI_CONFIG.ICON_SIZE" aria-hidden="true" />
        <span>{{ tab.name }}</span>
      </button>
    </nav>
  </header>
</template>

<script setup lang="ts">
import type { IconName } from "~/utils/icons.generated";
import { computed, nextTick, useId, type PropType } from "vue";
import { disabledState, focusRing, interactiveTransition } from "./variants";

type TabDirection = "row" | "column";
type ResponsiveDirection = Partial<Record<"base" | "sm" | "md" | "lg" | "xl" | "2xl", TabDirection>>;
type Orientation = "horizontal" | "vertical";
type ActivationMode = "automatic" | "manual";

export interface UiTabItem {
  key?: string;
  id?: string;
  name: string;
  icon?: IconName | string;
  panelId?: string;
  disabled?: boolean;
}

// Tailwind safelist for dynamically generated responsive classes.
const _TW_SAFELIST =
  "flex-row border-b border-muted gap-2 gap-5 text-sm flex-col gap-7 sm:flex-row sm:flex-col md:flex-row md:flex-col lg:flex-row lg:flex-col xl:flex-row xl:flex-col sm:gap-2 sm:gap-5 sm:gap-7 md:gap-2 md:gap-5 md:gap-7 lg:gap-2 lg:gap-5 lg:gap-7 xl:gap-2 xl:gap-5 xl:gap-7";

const props = defineProps({
  items: {
    type: Array as PropType<UiTabItem[]>,
    required: true,
  },
  modelValue: {
    type: Number,
    default: 0,
  },
  ariaLabel: {
    type: String,
    default: "Tabs",
  },
  orientation: {
    type: String as PropType<Orientation>,
    default: "horizontal",
  },
  activationMode: {
    type: String as PropType<ActivationMode>,
    default: "automatic",
  },
  idPrefix: {
    type: String,
    default: "",
  },
  borderClass: {
    type: String,
    default: "border-secondary",
  },
  activeClass: {
    type: String,
    default: "border-primary text-primary font-medium!",
  },
  inactiveClass: {
    type: String,
    default:
      "border-transparent text-content-secondary hover:border-secondary hover:text-content-on-surface font-light!",
  },
  buttonBaseClass: {
    type: String,
    default:
      "flex min-h-[var(--target-touch)] shrink-0 items-center gap-2 rounded-[var(--radius-md)] px-3 font-medium text-sm text-nowrap",
  },
  direction: {
    type: [String, Object] as PropType<TabDirection | ResponsiveDirection>,
    default: "column",
  },
});

const emit = defineEmits<{
  "update:modelValue": [index: number];
  select: [index: number];
}>();

const generatedTabsId = useId();
const tabsId = computed(() => props.idPrefix || generatedTabsId);
const breakpointOrder = ["base", "sm", "md", "lg", "xl", "2xl"] as const;

const activeIndexLocal = computed(() => {
  if (!props.items.length) return -1;
  return Math.min(Math.max(props.modelValue, 0), props.items.length - 1);
});

const resolvedOrientation = computed(() =>
  props.orientation === "vertical" ? "vertical" : "horizontal",
);

const directionClass = computed(() => {
  const dir = props.direction;
  if (typeof dir === "string") {
    return dir === "row"
      ? "flex-row border-b border-muted gap-2 sm:gap-5 text-sm"
      : "flex-col gap-2";
  }

  const classes: string[] = [];
  for (const bp of breakpointOrder) {
    const val = (dir as ResponsiveDirection)[bp];
    if (!val) continue;

    const tokenString =
      val === "row"
        ? "flex-row border-b border-muted gap-2 sm:gap-5 text-sm"
        : "flex-col gap-2";

    const tokens = tokenString.split(" ");
    if (bp === "base") {
      classes.push(...tokens);
    } else {
      classes.push(...tokens.map((t) => `${bp}:${t}`));
    }
  }

  return classes.join(" ");
});

function tabKey(tab: UiTabItem, index: number) {
  return tab.key ?? tab.id ?? index;
}

function isIconifyIcon(icon: string) {
  return icon.startsWith("i-");
}

function tabSlug(tab: UiTabItem, index: number) {
  return String(tab.key ?? tab.id ?? index).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function tabId(index: number) {
  const tab = props.items[index];
  return `${tabsId.value}-tab-${tab ? tabSlug(tab, index) : index}`;
}

function panelId(index: number) {
  const tab = props.items[index];
  return tab?.panelId ?? `${tabsId.value}-panel-${tab ? tabSlug(tab, index) : index}`;
}

function enabledIndices() {
  return props.items
    .map((tab, index) => ({ tab, index }))
    .filter(({ tab }) => !tab.disabled)
    .map(({ index }) => index);
}

function onSelect(index: number) {
  if (props.items[index]?.disabled) return;
  emit("update:modelValue", index);
  emit("select", index);
}

async function focusTab(index: number) {
  await nextTick();
  document.getElementById(tabId(index))?.focus();
}

function adjacentIndex(currentIndex: number, direction: 1 | -1) {
  const enabled = enabledIndices();
  if (!enabled.length) return currentIndex;
  const currentPosition = enabled.indexOf(currentIndex);
  const safePosition = currentPosition === -1 ? 0 : currentPosition;
  const nextPosition = (safePosition + direction + enabled.length) % enabled.length;
  return enabled[nextPosition] ?? currentIndex;
}

function onTabKeydown(index: number, event: KeyboardEvent) {
  const isHorizontal = resolvedOrientation.value === "horizontal";
  const nextKeys = isHorizontal ? ["ArrowRight"] : ["ArrowDown"];
  const previousKeys = isHorizontal ? ["ArrowLeft"] : ["ArrowUp"];

  let nextIndex: number | null = null;
  if (nextKeys.includes(event.key)) nextIndex = adjacentIndex(index, 1);
  if (previousKeys.includes(event.key)) nextIndex = adjacentIndex(index, -1);
  if (event.key === "Home") nextIndex = enabledIndices()[0] ?? index;
  if (event.key === "End") {
    const enabled = enabledIndices();
    nextIndex = enabled[enabled.length - 1] ?? index;
  }

  if (nextIndex !== null) {
    event.preventDefault();
    void focusTab(nextIndex);
    if (props.activationMode === "automatic") onSelect(nextIndex);
    return;
  }

  if (props.activationMode === "manual" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    onSelect(index);
  }
}
</script>
