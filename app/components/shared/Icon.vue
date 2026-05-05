<script setup lang="ts">
import { computed } from 'vue'
import type { IconName } from '~/utils/icons.generated';

const _TailwindColors = [
  'white',
  'black',
  'content-on-surface',
  'content-primary',
  'content-on-primary',
  'content-surface-strong',
] as const

const props = defineProps<{
  name: IconName
  color?: 'white' | 'black' | 'content-on-surface' | 'content-primary' | 'content-on-primary' | 'content-surface-strong' | string
}>()

const rawIcons = import.meta.glob('~/assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const iconMap = Object.fromEntries(
  Object.entries(rawIcons).map(([path, svg]) => {
    const name = path.split('/').pop()!.replace('.svg', '')
    return [name, svg]
  })
) as Record<IconName, string>

const svg = computed(() => iconMap[props.name])
</script>

<template>
  <span :class="[
    'inline-flex',
    'size-4',
    'items-center',
    'justify-center',
    props.color ? `text-${props.color}` : ''
  ]" v-html="svg" />
</template>