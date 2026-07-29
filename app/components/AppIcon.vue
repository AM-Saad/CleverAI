<script setup lang="ts">
import { computed } from 'vue';
import { ICON_SPRITE_URL } from '~/utils/icon-sprite.generated';
import type { IconName } from '~/utils/icons.generated';

interface Props {
  name: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | string;
  color?: 'primary' | 'secondary' | 'accent' | 'disabled' | 'error' | 'success' | 'warning' | 'white' | 'black' | string;
  interactive?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  interactive: false,
});

const SIZE_CLASSES = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

/** True for sizes that must be applied as an inline style rather than a class. */
function isLiteralLength(size: Props['size']): boolean {
  if (typeof size === 'number') return true;
  return typeof size === 'string' && (size.endsWith('px') || size.endsWith('rem'));
}

const sizeClass = computed(() => {
  const { size } = props;
  if (isLiteralLength(size)) return '';
  if (typeof size === 'string') {
    if (size in SIZE_CLASSES) return SIZE_CLASSES[size as keyof typeof SIZE_CLASSES];
    if (size.startsWith('w-')) return size;
  }
  return SIZE_CLASSES.md;
});

/**
 * Literal lengths go through `style`, not a class. An interpolated
 * `w-[${size}px]` never appears verbatim in source, so Tailwind's scanner
 * never emits a rule for it and the icon silently collapses.
 */
const sizeStyle = computed(() => {
  const { size } = props;
  if (!isLiteralLength(size)) return undefined;
  const length = typeof size === 'number' ? `${size}px` : size;
  return { width: length, height: length };
});

const colorClass = computed(() => {
  if (!props.color) return '';
  const tokenMap: Record<string, string> = {
    primary: 'text-[var(--color-primary)]',
    secondary: 'text-[var(--color-content-secondary)]',
    disabled: 'text-[var(--color-content-disabled)]',
    accent: 'text-[var(--color-accent-indigo)]',
    error: 'text-[var(--color-error)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    white: 'text-white',
    black: 'text-black', // design-allow: explicit caller opt-in; no black token exists
  };
  return tokenMap[props.color] || (props.color.startsWith('text-') ? props.color : `text-${props.color}`);
});

/**
 * Icons reference a build-time sprite (`public/icons.svg`) instead of inlining
 * markup. The sprite is one cacheable static asset precached by the service
 * worker, so it costs a single request and survives deploys — whereas inlining
 * put every icon in the entry chunk, re-downloaded on every release.
 */
const symbolHref = computed(() => `${ICON_SPRITE_URL}#${props.name}`);

/** Rendered under ~18px, where the signature 1.5 stroke goes faint. */
const isDense = computed(() => {
  const { size } = props;
  if (typeof size === 'number') return size < 18;
  if (typeof size === 'string') {
    if (size === 'xs' || size === 'sm') return true;
    const px = size.endsWith('px') ? Number.parseFloat(size) : NaN;
    if (!Number.isNaN(px)) return px < 18;
  }
  return false;
});
</script>

<template>
  <span
    :class="[
      'app-icon',
      sizeClass,
      colorClass,
      isDense ? 'app-icon--dense' : '',
      props.interactive ? 'app-icon--interactive' : '',
    ]"
    :style="sizeStyle"
  >
    <!-- Decorative: an accessible name belongs on the surrounding control. -->
    <svg aria-hidden="true" focusable="false">
      <use :href="symbolHref" />
    </svg>
  </span>
</template>
