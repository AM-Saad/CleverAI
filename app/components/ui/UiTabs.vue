<template>
  <header :class="['max-w-full min-w-fit', borderClass]">
    <nav :class="['flex', directionClass]">
      <button v-for="(tab, index) in items" :key="index" type="button" :class="[
        'cursor-pointer ',
        buttonBaseClass,
        activeIndexLocal === index ? activeClass : inactiveClass,
      ]" @click="onSelect(index)">
        <UIcon v-if="tab.icon" :name="String(tab.icon)" :size="UI_CONFIG.ICON_SIZE" />
        <span>{{ tab.name }}</span>
      </button>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { toRef, computed, type PropType } from "vue";
// Tailwind safelist for dynamically generated responsive classes
const _TW_SAFELIST = 'flex-row border-b border-muted gap-5 text-sm flex-col gap-7 sm:flex-row sm:flex-col md:flex-row md:flex-col lg:flex-row lg:flex-col xl:flex-row xl:flex-col sm:gap-5 sm:gap-7 md:gap-5 md:gap-7 lg:gap-5 lg:gap-7 xl:gap-5 xl:gap-7';
const props = defineProps({
  items: {
    type: Array as () => Array<Record<string, unknown>>,
    required: true,
  },
  modelValue: {
    type: Number,
    default: 0,
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
      "border-transparent text-on-surface  hover:border-gray-300 font-light!",
  },
  buttonBaseClass: {
    type: String,
    default: "flex items-center gap-2 font-medium text-sm transition-colors text-nowrap",
  },
  direction: {
    type: [String, Object] as PropType<string | Record<string, string>>,
    default: "column",
  },
});

const breakpointOrder = ["base", "sm", "md", "lg", "xl", "2xl"] as const;

const directionClass = computed(() => {
  const dir = props.direction;
  if (typeof dir === "string") {
    return dir === "row"
      ? "flex-row  border-muted gap-5 text-sm "
      : "flex-col gap-7";
  }

  const classes: string[] = [];
  for (const bp of breakpointOrder) {
    const val = (dir as Record<string, string>)[bp];
    if (!val) continue;

    const tokenString =
      val === "row"
        ? "flex-row border-b border-muted gap-5 text-sm"
        : "flex-col gap-7";

    const tokens = tokenString.split(" ");
    if (bp === "base") {
      classes.push(...tokens);
    } else {
      classes.push(...tokens.map((t) => `${bp}:${t}`));
    }
  }

  return classes.join(" ");
});

const emit = defineEmits(["update:modelValue", "select"]);

const activeIndexLocal = toRef(props, "modelValue");

function onSelect(index: number) {
  emit("update:modelValue", index);
  emit("select", index);
}
</script>

<style scoped>
.border-b {
  border-bottom-width: 1px;
}
</style>
