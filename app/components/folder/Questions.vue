<template>
    <div>
        <div class="flex items-center justify-end">
            <span
v-if="rateLimitRemaining !== null"
                class="inline-flex items-center text-xs px-2 py-1 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-700/50">
                Remaining: <span class="ml-1 font-medium">{{ rateLimitRemaining }}</span>
            </span>
            <UButton
:size="'xs'" :loading="generating || loading" :disabled="generating || loading"
                @click="onGenerate">
                <span v-if="!generating">Generate Questions</span>
                <span v-else>Generating…</span>
            </UButton>
        </div>

        <p v-if="(!questionsToShow || questionsToShow.length === 0) && !generating" class="mt-2 text-neutral-500">
            No questions yet. Click “Generate Questions” to create some from this folder's content.
        </p>

        <p v-if="genError" class="mt-2 text-error">
            {{ genError }}
        </p>

        <div v-if="questionsToShow?.length" class="mt-4 space-y-4">
            <div
v-for="(q, idx) in questionsToShow" :key="idx"
                class="border rounded-md p-3 bg-white dark:bg-foreground">
                <div class="font-medium mb-2">
                    {{ idx + 1 }}. {{ q.question }}
                </div>
                <ul class="list-disc ml-5">
                    <li
v-for="(choice, cIdx) in q.choices" :key="cIdx"
                        :class="{ 'font-semibold text-green-600': cIdx === q.answerIndex }">
                        {{ choice }}
                    </li>
                </ul>
            </div>
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
