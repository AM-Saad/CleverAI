<template>
    <component :is="tag" :class="[
        'ui-subtitle',
        sizeClasses[size],
        weightClasses[weight],
        colorClasses[color],
        center ? 'text-center' : ''
    ]">
        <slot />
    </component>
</template>

<script setup lang="ts">
interface Props {
    /**
     * HTML tag to render
     */
    tag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'div' | 'span'
    /**
     * Subtitle size variant
     */
    size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl'
    /**
     * Font weight
     */
    weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
    /**
     * Text color variant
     */
    color?: 'primary' | 'secondary' | 'neutral' | 'muted' | 'inverse' | 'white'
    /**
     * Center alignment
     */
    center?: boolean
}

const {
    tag = 'h3',
    size = 'lg',
    weight = 'medium',
    color = 'secondary',
    center = false
} = defineProps<Props>()

const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl'
}

const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold'
}

const colorClasses = {
    primary: 'text-[color:var(--color-text-primary)]',
    secondary: 'text-[color:var(--color-text-secondary)]',
    neutral: 'text-[color:var(--color-neutral)]',
    muted: 'text-[color:var(--color-text-muted)]',
    inverse: 'text-[color:var(--color-text-inverse)]',
    white: 'text-white'
}
</script>

<style scoped>
.ui-subtitle {
    font-family: var(--font-sans);
    margin: 0;
    line-height: var(--line-height-normal);
}
</style>
