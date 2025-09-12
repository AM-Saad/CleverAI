<template>
    <button :disabled="isSubmitting || isEnrolled"
        class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors"
        @click="handleEnroll">
        <svg v-if="isSubmitting" class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg"
            fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>

        <svg v-else-if="isEnrolled" class="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
        </svg>

        <svg v-else class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>

        {{ buttonText }}
    </button>
</template>

<script setup lang="ts">
import type { EnrollCardResponse } from '~/shared/review.contract'

interface Props {
    materialId?: string
    resourceType?: 'material' | 'flashcard'
    resourceId?: string
    isEnrolled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    enrolled: [response: EnrollCardResponse]
    error: [error: string]
}>()

// State
const isSubmitting = ref(false)

// Computed
const buttonText = computed(() => {
    if (isSubmitting.value) return 'Enrolling...'
    if (props.isEnrolled) return 'Enrolled'
    return 'Add to Review'
})

// Determine actual resource type and ID
const actualResourceType = computed(() => {
    if (props.resourceType) return props.resourceType
    return props.materialId ? 'material' : 'flashcard'
})

const actualResourceId = computed(() => {
    if (props.resourceId) return props.resourceId
    return props.materialId || ''
})

// Methods
const handleEnroll = async () => {
    if (isSubmitting.value || props.isEnrolled || !actualResourceId.value) return

    isSubmitting.value = true

    try {
        const { $api } = useNuxtApp()
        const response = await $api.review.enroll({
            resourceType: actualResourceType.value,
            resourceId: actualResourceId.value
        })

        if (response.success) {
            emit('enrolled', response)
        } else {
            emit('error', response.message || 'Failed to enroll card')
        }
    } catch (error: unknown) {
        const errorMsg = error && typeof error === 'object' && 'message' in error
            ? (error as { message?: string }).message
            : 'Failed to enroll card'
        emit('error', errorMsg || 'Failed to enroll card')
    } finally {
        isSubmitting.value = false
    }
}
</script>
