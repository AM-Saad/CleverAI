<template>
    <div>
        <div class="flex items-center justify-end">
            <span v-if="rateLimitRemaining !== null"
                class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
                Remaining: <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
            </span>
            <UButton :loading="generating || loading" :disabled="generating || loading" @click="onGenerate">
                <span v-if="!generating">Generate Questions</span>
                <span v-else>Generating…</span>
            </UButton>
        </div>

        <UiParagraph v-if="(!questionsToShow || questionsToShow.length === 0) && !generating">
            No questions yet. Click “Generate Questions” to create some from this folder's content.
        </UiParagraph>

        <shared-error-message v-if="genError" :error="genError" class="mt-2" />

        <div v-if="questionsToShow?.length" class="mt-4 space-y-4">
            <UiCard v-for="(q, idx) in questionsToShow" :key="idx">
                <div class="font-medium mb-2">
                    {{ idx + 1 }}. {{ q.question }}
                </div>
                <ul class="list-disc ml-5">
                    <!-- <li v-for="(choice, cIdx) in q.choices" :key="cIdx"
                        :class="{ 'font-semibold text-success': cIdx === q.answerIndex }">
                        {{ choice }}
                    </li> -->
                </ul>
            </UiCard>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useGenerateQuiz, useFolder } from '~/composables/folders/useFolders'
import { extractContentFromFolder } from '~/composables/folders/extractContent'
import { computed } from 'vue'
import type { Folder } from '~~/shared/folder.contract'

const route = useRoute()
const id = route.params.id as string

const { folder, loading } = useFolder(id)

const existingQuestions = computed(() => (folder.value as Folder | null | undefined)?.questions || [])
const questionsToShow = computed(() => questions.value?.length ? questions.value : existingQuestions.value)

const model = computed(() => (folder.value as Folder | null | undefined)?.llmModel)
const text = computed(() => extractContentFromFolder(folder.value as Folder | null | undefined))

const { questions, generating, genError, generate, rateLimitRemaining } = useGenerateQuiz(model, text, computed(() => id))

async function onGenerate() {
    await generate()
}
</script>
