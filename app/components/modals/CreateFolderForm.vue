<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useCreateFolder } from '~/composables/folders/useFolders'
import { LLM_MODELS, LLMEnum } from '~~/shared/llm'

const emit = defineEmits(["cancel"])

const { createFolder, creating, error, typedError } = useCreateFolder()
const props = defineProps({
    show: Boolean,
})

const schema = z.object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    llmModel: z.preprocess(v => (typeof v === 'string' ? v.trim() : v), LLMEnum),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
    title: undefined,
    description: undefined,
    llmModel: 'gpt-3.5'
})
const llmModels = ref([...LLM_MODELS])
const toast = useToast()
const canSubmit = computed(() => !!state.title && state.title.trim().length > 0 && !creating.value)
async function onSubmit(event: FormSubmitEvent<Schema>) {

    event.preventDefault()
    if (!canSubmit.value) return
    try {
        await createFolder({
            title: state.title!.trim(),
            description: state.description?.trim() || undefined,
            llmModel: state.llmModel || 'gpt-3.5', // Default to gpt-3.5 if not specified
            metadata: {} // Add any additional metadata if needed
        })
        toast.add({ title: 'Folder created', description: 'Your folder is ready.', color: 'success' })

        emit("cancel")
    } catch (err) {
        toast.add({ title: 'Error', description: typedError.value?.message || 'An error occurred.' })
    }
    finally {
        state.title = ''
        state.description = ''
        state.llmModel = 'gpt-3.5'

    }
}




const closeModel = (): void => {
    emit("cancel")
}
</script>

<template>
    <Teleport to="body">
        <!-- use the modal component, pass in the prop -->
        <UiDialogModal :show="props.show" @close="closeModel">
            <template #header>
                <div class="flex flex-col gap-1">
                    <h3 class="flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                        <icon name="uil:folder-network" class="" />
                        Create New Folder
                    </h3>
                    <p class="font-normal text-sm text-neutral-500">Folder is a container for organizing your content.
                    </p>
                </div>

            </template>

            <template #body>
                <UForm :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
                    <UFormField label="Title" name="title">
                        <UiInput v-model="state.title" autofocus />
                    </UFormField>

                    <UFormField label="Description" name="description">
                        <UiInput v-model="state.description" />
                    </UFormField>
                    <UFormField label="LLM Model" name="llmModel">
                        <USelectMenu v-model="state.llmModel" color="neutral" variant="subtle" :items="llmModels"
                            class="w-48 " :ui="{
                                content: 'z-[9999] bg-white'
                            }" />
                        <p class="text-xs text-neutral-500">Select the LLM model for this folder.</p>
                    </UFormField>

                    <UButton type="submit" :loading="creating" :disabled="!canSubmit" class="w-full">

                        Submit
                    </UButton>
                </UForm>
            </template>
        </UiDialogModal>
    </Teleport>
</template>
