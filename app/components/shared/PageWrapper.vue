<template>
    <div v-if="!isPageLoading">
        <div class="flex justify-between">
            <div>
                <UiTitle tag="h1">{{ title }}</UiTitle>
                <UiParagraph v-if="subtitle" :class-name="'my-1'" variant="neutral">
                    {{ subtitle }}
                </UiParagraph>
            </div>
            <slot name="actions" />
        </div>
        <div class="mt-8">

            <slot name="default" />
        </div>
    </div>
    <ui-loader v-else :is-fetching="isPageLoading" label="Loading Folder..." />

</template>

<script setup lang="ts">

interface PageWrapperProps {
    // Define any props that the PageWrapper might need
    title?: string;
    subtitle?: string;
    isPageLoading?: boolean;
}
const props = defineProps<PageWrapperProps>();
</script>