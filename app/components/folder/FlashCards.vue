<template>
    <div>
        <div class="flex items-center justify-end">
            <div class="flex items-center gap-3">

                <span v-if="rateLimitRemaining !== null"
                    class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
                    Remaining: <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
                </span>
                <UButton class="flex items-center" :loading="generating || loading" :disabled="generating || loading"
                    @click="onGenerate">
                    <span v-if="!generating">Generate Flashcards</span>
                    <span v-else>Generating…</span>
                    <icons-stars-generative />
                </UButton>

            </div>
        </div>

        <UiParagraph v-if="(!cardsToShow || cardsToShow.length === 0) && !generating" class="mt-2">
            No flash cards yet. Click “Generate Flashcards” to create some from this folder's content.
        </UiParagraph>

        <UiParagraph v-if="genError" class="mt-2 text-error">
            {{ genError }}
        </UiParagraph>

        <div v-if="cardsToShow?.length"
            class="mt-4 grid gap-4 justify-center justify-items-center sm:grid-cols-2 md:grid-cols-3 ">
            <div v-for="(card, idx) in cardsToShow" :key="idx" class="relative">
                <ui-flip-card>
                    <template #front>
                        <UiParagraph class="w-4/5">Q: {{ card.front }}</UiParagraph>
                        <!-- Enrollment status indicator -->
                        <div v-if="'id' in card && card.id && enrolledCards.has(card.id)"
                            class="absolute top-2 right-2">
                            <span
                                class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-light border">
                                ✓
                            </span>
                        </div>
                    </template>
                    <template #back>
                        <UiParagraph class="mb-4">{{ card.back }}</UiParagraph>
                        <!-- Enroll Button -->
                        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <ReviewEnrollButton v-if="'id' in card && card.id" :resource-type="'flashcard'"
                                :resource-id="card.id" :is-enrolled="enrolledCards.has(card.id)"
                                @enrolled="handleCardEnrolled" @error="handleEnrollError" />
                            <div v-else class="text-xs">
                                Save card to enable review
                            </div>
                        </div>
                    </template>
                </ui-flip-card>
            </div>
        </div>

        <!-- Review Navigation -->
        <div v-if="cardsToShow?.length" class="mt-8 text-center">
            <UButton to="/review">
                <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                Start Review Session
            </UButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useGenerateFlashcards, useFolder } from '~/composables/folders/useFolders'
import { extractContentFromFolder } from '~/composables/folders/extractContent'
import { computed } from 'vue'
import type { Folder } from '~~/shared/folder.contract'
import type { EnrollCardResponse } from '~/shared/review.contract'

const route = useRoute()
const id = route.params.id as string

const { folder, loading } = useFolder(id)

const model = computed(() => (folder.value as Folder | null | undefined)?.llmModel)
const text = computed(() => extractContentFromFolder(folder.value as Folder | null | undefined))
console.log(text)

const existingFlashcards = computed(() => (folder.value as Folder | null | undefined)?.flashcards || [])
const { flashcards, generating, genError, generate, rateLimitRemaining } = useGenerateFlashcards(model, text, computed(() => id))
const cardsToShow = computed(() => flashcards.value?.length ? flashcards.value : existingFlashcards.value)

// Track enrolled cards
const enrolledCards = ref(new Set<string>())

// Check enrollment status when cards are available
watch(cardsToShow, async (cards) => {
    if (cards && cards.length > 0) {
        await checkEnrollmentStatus()
    }
}, { immediate: true })

async function checkEnrollmentStatus() {
    const cardIds = cardsToShow.value?.filter(card => card && typeof card === 'object' && 'id' in card && card.id).map(card => (card as { id: string }).id) || []
    if (cardIds.length === 0) return

    try {
        const { $api } = useNuxtApp()
        const response = await $api.review.getEnrollmentStatus(cardIds, 'flashcard')

        // Update enrolled cards Set
        enrolledCards.value.clear()
        Object.entries(response.enrollments).forEach(([cardId, isEnrolled]) => {
            if (isEnrolled) {
                enrolledCards.value.add(cardId)
            }
        })
    } catch (error) {
        console.error('Failed to check enrollment status:', error)
    }
}

function handleCardEnrolled(response: EnrollCardResponse) {
    if (response.success && response.cardId) {
        // The response.cardId is the CardReview ID, but we need to track by resource ID
        // Find which card was just enrolled by checking the EnrollButton's material-id prop
        // For now, we'll refetch the enrollment status to be sure
        checkEnrollmentStatus()
        console.log('Card enrolled successfully:', response.cardId)
    }
}

async function onGenerate() {
    await generate()
}

function handleEnrollError(error: string) {
    console.error('Failed to enroll card:', error)
    // You could show a toast notification here
}
</script>
