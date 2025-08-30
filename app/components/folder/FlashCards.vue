<template>
    <div>
        <div class="flex items-center justify-end">
            <div class="flex items-center gap-3">

                <span v-if="rateLimitRemaining !== null"
                    class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
                    Remaining: <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
                </span>
                <!-- <UButton :size="'xs'" :loading="generating || loading" :disabled="generating || loading"
                    @click="onGenerate">
                    <span v-if="!generating">Generate Flashcards</span>
                    <span v-else>Generating…</span>
                </UButton> -->
                <button :disabled="generating" class="flex items-center btn bg-primary text-accent" @click="onGenerate">
                    <span v-if="!generating">Generate Flashcards</span>
                    <span v-else>Generating…</span>
                    <icons-stars-generative />
                </button>
            </div>
        </div>

        <p v-if="(!cardsToShow || cardsToShow.length === 0) && !generating" class="mt-2 text-neutral-500">
            No flash cards yet. Click “Generate Flashcards” to create some from this folder's content.
        </p>

        <p v-if="genError" class="mt-2 text-error">
            {{ genError }}
        </p>

        <div v-if="cardsToShow?.length"
            class="mt-4 grid gap-4 justify-center justify-items-center sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div v-for="(card, idx) in cardsToShow" :key="idx">
                <!-- <div class="font-medium mb-1">Q: {{ card.front }}</div>
                <div class="text-sm text-neutral-600 dark:text-neutral-300">A: {{ card.back }}</div> -->
                <ui-flip-card>
                    <template #front>
                        <div class="font-medium mb-1 text-xl ">Q: {{ card.front }}</div>
                    </template>
                    <template #back>
                        <div class="text-base dark:text-neutral-300"> {{ card.back }}</div>
                    </template>
                </ui-flip-card>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useGenerateFlashcards, useFolder } from '~/composables/folders/useFolders'
import { extractContentFromFolder } from '~/composables/folders/extractContent'
import { computed } from 'vue'
import type { Folder } from '~~/shared/folder.contract'

const route = useRoute()
const id = route.params.id as string

const { folder, loading } = useFolder(id)

const model = computed(() => (folder.value as Folder | null | undefined)?.llmModel)
const text = computed(() => extractContentFromFolder(folder.value as Folder | null | undefined))

const existingFlashcards = computed(() => (folder.value as Folder | null | undefined)?.flashcards || [])
const { flashcards, generating, genError, generate, rateLimitRemaining } = useGenerateFlashcards(model, text, computed(() => id))
const cardsToShow = computed(() => flashcards.value?.length ? flashcards.value : existingFlashcards.value)

async function onGenerate() {
    await generate()
}
</script>
