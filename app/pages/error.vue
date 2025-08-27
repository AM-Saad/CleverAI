<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const props = defineProps({
    error: {
        type: Object as PropType<Error>,
        required: true,
    },
})

console.log('Error page loaded with error:', props.error);

</script>

<template>
    <NuxtExample>
        <div class="relative font-sans">
            <div class="md:w-6/12 max-w-200 mx-auto py-10 px-4">
                There was an error 😱

                <h1 class="text-2xl">{{ error?.message || 'Unknown error' }}</h1>
                <br />

                <NuxtLink class="bg-foreground btn btn-big my-4 text-white" to="/">
                    Navigate home
                </NuxtLink>
            </div>
        </div>
    </NuxtExample>
</template>
