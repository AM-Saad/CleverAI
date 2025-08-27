<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useRoute } from 'vue-router'
import { useUpdateFolder } from '~/composables/folders/useFolders'

const emit = defineEmits(["cancel"])

const props = defineProps({
    show: Boolean,
})

const schema = z.object({
    rawText: z.string().min(1, "Text is required"),

})

type Schema = z.output<typeof schema>


const state = reactive({
    rawText: "",
})

const route = useRoute()
const id = route.params.id as string
const { updateFolder, updating, typedError } = useUpdateFolder(id)

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<Schema>) {
    event.preventDefault()
    const text = state.rawText?.trim() ?? ''
    if (!text) {
        toast.add({ title: 'Validation', description: 'Text is required', color: 'warning' })
        return
    }
    try {
        await updateFolder({ rawText: text })
        toast.add({ title: 'Saved', description: 'Material uploaded to this folder.', color: 'success' })
        state.rawText = ''
        emit('cancel')
    } catch (err: any) {
        toast.add({
            title: 'Error',
            description: typedError.value?.message || err?.message || 'Failed to upload material.',
            color: 'error',
        })
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
                    <h4 class="flex items-center gap-2 text-lg font-semibold  dark:text-foreground">
                        <icon name="uil:folder-network" class="" />
                        Upload Material
                    </h4>
                    <p class="font-normal text-sm text-background dark:text-foreground">Upload your material files here.
                    </p>
                </div>

            </template>

            <template #body>
                <UForm :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
                    <UFormField label="Raw Text" name="rawText">
                        <UiTextArea v-model="state.rawText" />
                    </UFormField>

                    <UButton type="submit" :loading="updating">
                        Submit
                    </UButton>
                </UForm>
            </template>
        </UiDialogModal>
    </Teleport>
</template>
