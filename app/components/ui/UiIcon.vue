<template>
  <AppIcon v-if="localName" :name="localName" :size="size" :color="color" :interactive="interactive" v-bind="$attrs" />
  <UIcon v-else :name="name" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '~/components/AppIcon.vue';
import type { IconName } from '~/utils/icons.generated';
import { ICON_NAMES } from '~/utils/icons.generated';

/**
 * UiIcon — design system icon primitive.
 * Maps `i-lucide-*` and local names to local SVG assets automatically.
 */
interface Props {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  color?: 'primary' | 'secondary' | 'accent' | 'disabled' | 'error' | 'success' | 'warning' | 'white' | 'black' | string;
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  size: 'xs'
});

defineOptions({ inheritAttrs: false });

const localName = computed<IconName | null>(() => {
  if (!props.name) return null;
  const clean = props.name.replace(/^i-lucide-/, '') as IconName;
  if (ICON_NAMES.includes(clean)) return clean;
  if (ICON_NAMES.includes(props.name as IconName)) return props.name as IconName;
  return null;
});
</script>
