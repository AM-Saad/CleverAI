<template>
    <div>
        <div class="flex items-center justify-end">
            <div class="flex items-center gap-3">

                <span
v-if="rateLimitRemaining !== null"
                    class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
                    Remaining: <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
                </span>
                <UButton
class="flex items-center" :size="'lg'" :loading="generating || loading"
                    :disabled="generating || loading" @click="onGenerate">
                    <span v-if="!generating">Generate Flashcards</span>
                    <span v-else>Generating…</span>
                    <icons-stars-generative />
                </UButton>

            </div>
        </div>

        <p v-if="(!cardsToShow || cardsToShow.length === 0) && !generating" class="mt-2 text-neutral-500">
            No flash cards yet. Click “Generate Flashcards” to create some from this folder's content.
        </p>

        <p v-if="genError" class="mt-2 text-error">
            {{ genError }}
        </p>

        <div
            v-if="cardsToShow?.length"
            class="mt-4 grid gap-4 justify-center justify-items-center sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div v-for="(card, idx) in cardsToShow" :key="idx" class="relative">
                <ui-flip-card>
                    <template #front>
                        <div class="font-medium mb-1 text-xl">Q: {{ card.front }}</div>
                    </template>
                    <template #back>
                        <div class="text-base dark:text-neutral-300 mb-4">{{ card.back }}</div>
                        <!-- Enroll Button -->
                        <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <ReviewEnrollButton 
                                v-if="'id' in card && card.id"
                                :material-id="card.id"
                                :is-enrolled="enrolledCards.has(card.id)"
                                @enrolled="handleCardEnrolled"
                                @error="handleEnrollError"
                            />
                            <div v-else class="text-xs text-gray-500">
                                Save card to enable review
                            </div>
                        </div>
                    </template>
                </ui-flip-card>
            </div>
        </div>

        <!-- Review Navigation -->
        <div v-if="cardsToShow?.length" class="mt-8 text-center">
            <NuxtLink
                to="/review"
                class="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
                <svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                Start Review Session
            </NuxtLink>
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

const existingFlashcards = computed(() => (folder.value as Folder | null | undefined)?.flashcards || [])
const { flashcards, generating, genError, generate, rateLimitRemaining } = useGenerateFlashcards(model, text, computed(() => id))
const cardsToShow = computed(() => flashcards.value?.length ? flashcards.value : existingFlashcards.value)

// Track enrolled cards
const enrolledCards = ref(new Set<string>())

async function onGenerate() {
    await generate()
}

function handleCardEnrolled(response: EnrollCardResponse) {
  if (response.success && response.cardId) {
    // Since we're using material ID for enrollment, we need to track differently
    // For now, we'll just show a success message
    console.log('Card enrolled successfully:', response.cardId)
  }
}

function handleEnrollError(error: string) {
  console.error('Failed to enroll card:', error)
  // You could show a toast notification here
}
</script>
