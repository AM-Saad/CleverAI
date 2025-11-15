<template>
    <div v-if="!isPageLoading" class="flex flex-col gap-y-6" style="flex: 1 1 auto; min-height: 0;">
        <div class="flex justify-between" style="flex: 0 0 auto;">
            <div>
                <UiTitle tag="h1">{{ title }}</UiTitle>
                <UiParagraph v-if="subtitle" :class-name="'my-1'" variant="neutral">
                    {{ subtitle }}
                </UiParagraph>
            </div>
            <slot name="actions" />
        </div>
        <div class="flex flex-col overflow-auto" style="flex: 1 1 auto; min-height: 0;">
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