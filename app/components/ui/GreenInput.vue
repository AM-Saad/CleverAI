<!-- components/ui/GreenInput.vue -->
<template>
    <UInput
v-bind="$attrs" :ui="{
        base: 'relative block w-full disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none border-0 form-input rounded-md placeholder-gray-400 dark:placeholder-gray-500',
        variant: {
            outline: 'shadow-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white ring-1 ring-inset ring-green-500 focus:ring-2 focus:ring-green-600'
        }
    }" variant="outline" />
</template>

<script setup>
// This component wraps UInput with green styling using proper Nuxt UI ring classes
defineOptions({
    inheritAttrs: false
})
</script>
