<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useRoute } from 'vue-router'
import { useUpdateFolder } from '~/composables/folders/useFolders'

const emit = defineEmits<{ (e: 'closed'): void; (e: 'cancel'): void }>()

type MobileProp = boolean | 'auto'
const props = withDefaults(defineProps<{
    show: boolean
    // pass‑through Drawer options (all optional)
    side?: 'right' | 'left'
    mobile?: MobileProp
    breakpoint?: string
    handleVisible?: number
    sheetHeight?: string
    widthClasses?: string
    teleportTo?: string
    lockScroll?: boolean
    threshold?: number
    fastVelocity?: number
    backdrop?: boolean
}>(), {
    side: 'right',
    mobile: 'auto',
    breakpoint: '(max-width: 639px)',
    handleVisible: 28,
    sheetHeight: '75vh',
    widthClasses: 'w-1/3 min-w-60',
    teleportTo: 'body',
    lockScroll: true,
    threshold: 20,
    fastVelocity: 450,
    backdrop: true
})

// ----- Form schema & state -----
const schema = z.object({
    materialTitle: z.string().min(1, 'Title is required'),
    materialType: z.enum(['text', 'video', 'audio', 'pdf', 'url', 'document']).default('text'),
    materialContent: z.string().min(1, 'Content is required'),
})

type Schema = z.output<typeof schema>

const state = reactive<Schema>({
    materialTitle: '',
    materialType: 'text',
    materialContent: ''
})

const route = useRoute()
const id = route.params.id as string
const { updateFolder, updating, typedError } = useUpdateFolder(id)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<Schema>) {
    event.preventDefault()
    const title = state.materialTitle.trim()
    const content = state.materialContent.trim()
    if (!title || !content) {
        toast.add({ title: 'Validation', description: 'Content and title are required', color: 'warning' })
        return
    }
    try {
        await updateFolder({
            materialTitle: title,
            materialContent: content,
            materialType: state.materialType
        })
        toast.add({ title: 'Saved', description: 'Material uploaded to this folder.', color: 'success' })
        // reset and close
        state.materialTitle = ''
        state.materialContent = ''
        state.materialType = 'text'
        emit('cancel')
    } catch (err: unknown) {
        toast.add({ title: 'Error', description: typedError.value?.message || (err as Error)?.message || 'Failed to upload material.', color: 'error' })
    }
}
</script>

<template>
    <ui-drawer
:show="props.show" :side="props.side" :mobile="props.mobile" :breakpoint="props.breakpoint"
        :handle-visible="props.handleVisible" :sheet-height="props.sheetHeight" :width-classes="props.widthClasses"
        :teleport-to="props.teleportTo" :lock-scroll="props.lockScroll" :threshold="props.threshold"
        :backdrop="props.backdrop" :fast-velocity="props.fastVelocity" title="Upload Material" @closed="emit('closed')">
        <template #subtitle>
            <p class="text-sm opacity-70">Upload your material files here.</p>
        </template>

        <UForm :schema="schema" :state="state" class="space-y-2" @submit="onSubmit">
            <UFormField label="Material Title" name="materialTitle">
                <UInput v-model="state.materialTitle" placeholder="Enter material title" />
            </UFormField>

            <UFormField label="Material Type" name="materialType">
                <USelect
v-model="state.materialType" :options="[
                    { label: 'Text', value: 'text' },
                    { label: 'Video', value: 'video' },
                    { label: 'Audio', value: 'audio' },
                    { label: 'PDF', value: 'pdf' },
                    { label: 'URL', value: 'url' },
                    { label: 'Document', value: 'document' }
                ]" />
            </UFormField>

            <UFormField label="Material Content" name="materialContent">
                <UiTextArea v-model="state.materialContent" placeholder="Enter your material content here..." />
            </UFormField>

            <div class="flex gap-2 mt-3">
                <UButton type="submit" :loading="updating">Submit</UButton>
                <UButton color="neutral" variant="soft" @click="emit('cancel')">Cancel</UButton>
            </div>
        </UForm>
    </ui-drawer>
</template>
