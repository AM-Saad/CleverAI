<template>
    <div class="materials-list">
        <div v-if="loading" class="text-center py-6">Loading materials...</div>
        <div v-else-if="error" class="text-red-600">{{ errorMessage }}</div>

        <ul v-else class="space-y-3 mt-4">
            <UiCard tag="article" v-for="m in materialList" :key="m.id">
                <div class="flex-1">
                    <div class="flex items-center gap-2">
                        <div class="flex w-full justify-between items-center gap-2">
                            <UiSubtitle>{{ m.title }}</UiSubtitle>
                            <div class="ml-4 flex-shrink-0 flex gap-2">
                                <!-- Enrollment button -->
                                <ReviewEnrollButton :resource-type="'material'" :resource-id="m.id"
                                    :is-enrolled="enrolledMaterials.has(m.id)" @enrolled="handleMaterialEnrolled"
                                    @error="handleEnrollError" />
                                <UButton :disabled="removing" variant="outline" color="error"
                                    @click="() => confirmRemoval(m.id)">
                                    Remove</UButton>

                            </div>
                        </div>
                        <span v-if="enrolledMaterials.has(m.id)"
                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd" />
                            </svg>
                            Enrolled
                        </span>
                    </div>
                    <div>
                        <UButton size="xs" variant="ghost" class="mb-2" @click="() => toggleContent(m.id)">
                            <span v-if="!expandedMaterials.has(m.id)">Show Content</span>
                            <span v-else>Hide Content</span>
                        </UButton>
                        <transition name="fade-slide">
                            <UiCard v-if="expandedMaterials.has(m.id)" tag="article" class="mt-4">
                                <UiParagraph class="whitespace-pre-wrap">{{ m.content }}</UiParagraph>
                            </UiCard>
                        </transition>
                    </div>
                </div>
            </UiCard>
        </ul>

        <UiParagraph v-if="!loading && materialList.length === 0">
            No materials in this folder.
        </UiParagraph>
    </div>
    <!-- Confirmation Modal -->
    <DialogModal :show="showConfirm" @close="() => { showConfirm = false; confirmId = null }">
        <template #header>
            <div class="flex flex-col gap-1">
                <h3 class="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    <icon name="ic:round-play-lesson" class="" />
                    Confirm Delete
                </h3>
                <p class="font-normal text-sm text-neutral-500">
                    Are you sure you want to delete this material? This action cannot be undone.
                </p>
            </div>
        </template>
        <template #body>
            <div></div>
        </template>
        <template #footer>
            <div class="flex gap-3 pt-4">
                <UButton type="submit" @click="doConfirmRemove" color="primary">
                    Delete
                </UButton>

                <UButton type="button" variant="ghost" class="flex-1"
                    @click="() => { showConfirm = false; confirmId = null }">
                    Cancel
                </UButton>
            </div>
        </template>
    </DialogModal>
</template>

<script setup lang="ts">
// Track expanded/collapsed state for each material
const expandedMaterials = ref(new Set<string>())

function toggleContent(id: string) {
    if (expandedMaterials.value.has(id)) {
        expandedMaterials.value.delete(id)
    } else {
        expandedMaterials.value.add(id)
    }
}
import { useMaterials } from '~/composables/folders/useMaterials'
import DialogModal from '~/components/shared/DialogModal.vue'
import ReviewEnrollButton from '~/components/review/EnrollButton.vue'
import type { EnrollCardResponse } from '~/shared/review.contract'

const props = defineProps<{ folderId: string }>()
const emit = defineEmits<{
    removed: [id: string]
    error: [err: string]
}>()

const { materials, loading, error, removing, removeMaterial } = useMaterials(props.folderId)

const materialList = computed(() => materials.value ?? [])

// Track enrolled materials
const enrolledMaterials = ref(new Set<string>())

// Check enrollment status when materials are available
watch(materialList, async (mats) => {
    if (mats && mats.length > 0) {
        await checkEnrollmentStatus()
    }
}, { immediate: true })

async function checkEnrollmentStatus() {
    const materialIds = materialList.value.map(m => m.id)
    if (materialIds.length === 0) return

    try {
        const { $api } = useNuxtApp()
        const response = await $api.review.getEnrollmentStatus(materialIds, 'material')

        // Update enrolled materials Set
        enrolledMaterials.value.clear()
        Object.entries(response.enrollments).forEach(([materialId, isEnrolled]) => {
            if (isEnrolled) {
                enrolledMaterials.value.add(materialId)
            }
        })
    } catch (error) {
        console.error('Failed to check enrollment status:', error)
    }
}

function handleMaterialEnrolled(response: EnrollCardResponse) {
    if (response.success) {
        // Refresh enrollment status to be sure
        checkEnrollmentStatus()
        console.log('Material enrolled successfully:', response.cardId)
    }
}

function handleEnrollError(error: string) {
    console.error('Failed to enroll material:', error)
    emit('error', error)
}

const errorMessage = computed(() => {
    if (!error.value) return ''
    if (typeof error.value === 'string') return error.value
    // Try to extract structured message if available
    const e = error.value as unknown as { data?: { message?: string }; message?: string }
    return e?.data?.message ?? e?.message ?? 'Failed to load materials'
})



const showConfirm = ref(false)
const confirmId = ref<string | null>(null)

const confirmRemoval = (id: string) => {
    confirmId.value = id
    showConfirm.value = true
}

const doConfirmRemove = async () => {
    if (!confirmId.value) return
    try {
        await removeMaterial(confirmId.value)
        emit('removed', confirmId.value)
    } catch (err: unknown) {
        const e = err as unknown as { data?: { message?: string }; message?: string }
        const msg = e?.data?.message ?? e?.message ?? 'Failed to remove material'
        emit('error', msg)
    } finally {
        showConfirm.value = false
        confirmId.value = null
    }
}

</script>

<style scoped>
.materials-list ul {
    list-style: none;
    padding: 0;
    margin: 0
}

/* Transition for material content */
.fade-slide-enter-active,
.fade-slide-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
    opacity: 1;
    transform: translateY(0);
}
</style>
