<template>
    <component :is="tag" :class="[
        'ui-paragraph',
        sizeClasses[size],
        colorClasses[color],
        center ? 'text-center' : '',
        className
    ]">
        <slot />
    </component>
</template>

<script setup lang="ts">
interface Props {
    /**
     * HTML tag to render
     */
    tag?: 'p' | 'span' | 'div'
    /**
     * Text size variant
     */
    size?: 'xs' | 'sm' | 'base' | 'lg'
    /**
     * Text color variant
     */
    color?: 'primary' | 'secondary' | 'neutral' | 'muted' | 'inverse' | 'white'
    /**
     * Center alignment
     */
    center?: boolean
    /**
     * Additional CSS classes
     */
    className?: string
}

const {
    tag = 'p',
    size = 'base',
    color = 'neutral',
    center = false,
    className = ''
} = defineProps<Props>()

const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
}

const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    neutral: 'text-dark dark:text-light',
    muted: 'text-muted',
    inverse: 'text-inverse',
    white: 'text-white'
}
</script>

<style scoped>
.ui-paragraph {
    font-family: var(--font-sans);
    margin: 0;
    line-height: var(--line-height-normal);
}
</style>
