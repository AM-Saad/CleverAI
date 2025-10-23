<!-- components/ui/StyledButton.vue -->
<template>
  <UButton v-bind="$attrs" :ui="buttonStyles" :class="computedClasses">
    <slot />
  </UButton>
</template>

<script setup lang="ts">
interface Props {
  theme?:
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "gradient";
  rounded?: "none" | "sm" | "md" | "lg" | "full";
  elevation?: "none" | "sm" | "md" | "lg";
}

const props = withDefaults(defineProps<Props>(), {
  theme: "primary",
  rounded: "md",
  elevation: "sm",
});

defineOptions({
  inheritAttrs: false,
});

// Define our custom button styles
const buttonStyles = computed(() => ({
  base: "focus:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-75 flex-shrink-0 font-semibold transition-all duration-200",
  font: "font-semibold",
  rounded: {
    none: "rounded-none",
    sm: "rounded-sm",
    md: "rounded-lg",
    lg: "rounded-xl",
    full: "rounded-full",
  }[props.rounded],
  size: {
    xs: "text-xs px-3 py-1.5",
    sm: "text-sm px-4 py-2",
    md: "text-sm px-6 py-3",
    lg: "text-base px-8 py-4",
    xl: "text-lg px-10 py-5",
  },
}));

// Theme-based styling
const themeClasses = computed(() => {
  const themes = {
    primary: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white",
    secondary: "bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white",
    success: "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white",
    warning:
      "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white",
    danger: "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white",
    gradient:
      "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white",
  };
  return themes[props.theme];
});

// Elevation/Shadow classes
const elevationClasses = computed(() => {
  const elevations = {
    none: "",
    sm: "shadow-sm hover:shadow-md",
    md: "shadow-md hover:shadow-lg",
    lg: "shadow-lg hover:shadow-xl",
  };
  return elevations[props.elevation];
});

// Combine all computed classes
const computedClasses = computed(() => {
  return [
    themeClasses.value,
    elevationClasses.value,
    "transform hover:scale-105 active:scale-95",
  ]
    .filter(Boolean)
    .join(" ");
});
</script>
