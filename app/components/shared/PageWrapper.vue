<template>
    <div
        v-if="!isPageLoading"
        class="flex min-w-0 flex-col gap-y-4"
        :class="fixedHeight ? 'min-h-0 flex-1' : 'min-h-full'"
    >
        <div class="flex min-w-0 justify-between flex-col md:flex-row items-start gap-2 md:items-center">
            <div class="min-w-0">
                <slot name="header-info-leading" />

                <UiTitle tag="h1" color="content-on-background">{{ title }}</UiTitle>
                <UiParagraph v-if="subtitle" :class-name="'my-1'" variant="neutral">
                    {{ subtitle }}
                </UiParagraph>
                <slot name="header-info" />
            </div>
            <slot name="actions" />
        </div>
        <div
            class="flex min-w-0 flex-col"
            :class="fixedHeight ? 'min-h-0 flex-1 overflow-hidden' : 'overflow-visible'"
        >
            <slot name="default" />
        </div>
    </div>
    <ui-loader v-else :is-fetching="isPageLoading" label="Loading Workspace..." />

</template>

<script setup lang="ts">

interface PageWrapperProps {
    // Define any props that the PageWrapper might need
    title?: string;
    subtitle?: string;
    isPageLoading?: boolean;
    fixedHeight?: boolean;
}
const props = defineProps<PageWrapperProps>();
</script>
