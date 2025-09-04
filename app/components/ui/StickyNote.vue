<template>
    <div class="sticky-note relative group" :class="[
        stickyNoteClasses,
        { 'pointer-events-none': note.loading }
    ]" @dblclick="startEditing">
        <!-- Paper-like background with shadow and texture -->
        <div
            class="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded shadow-lg transform rotate-1 opacity-60">
        </div>
        <!-- <div
            class="absolute inset-0 bg-gradient-to-br from-orange-100/20 via-amber-50 to-yellow-100/10 rounded shadow-lg border border-amber-200/10">
        </div> -->

        <!-- Content area -->
        <div class="relative p-4 h-full flex flex-col">
            <!-- Edit icon -->
            <button v-if="!isEditing && !note.loading"
                class="absolute top-2 right-2 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                aria-label="Edit note" @click="startEditing">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
            </button>

            <!-- Loading state -->
            <div v-if="note.loading" class="flex items-center justify-center h-full">
                <div class="flex items-center gap-2 text-amber-700">
                    <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span class="text-sm font-medium">Saving...</span>
                </div>
            </div>

            <!-- Error state -->
            <div v-else-if="note.error" class="flex flex-col items-center justify-center h-full text-red-600">
                <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm font-medium text-center">{{ note.error }}</span>
                <button class="mt-2 text-xs text-red-500 hover:text-red-700 underline" @click="retry">
                    Try again
                </button>
            </div>

            <!-- Edit mode -->
            <template v-else-if="isEditing">
                <textarea ref="textareaRef" v-model="editText"
                    class="w-full h-full resize-none bg-transparent border-none outline-none text-amber-900 placeholder-amber-600/50 font-handwriting text-base leading-relaxed p-0"
                    :placeholder="placeholder" :disabled="note.loading" @blur="saveNote" @keydown.esc="cancelEdit"
                    @keydown.ctrl.enter="saveNote" @keydown.meta.enter="saveNote" />
                <div class="flex justify-end gap-2 mt-2 pt-2 border-t border-amber-200/40">
                    <button
                        class="px-3 py-1 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100/50 rounded transition-colors"
                        :disabled="note.loading" @click="cancelEdit">
                        Cancel
                    </button>
                    <button
                        class="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                        :disabled="note.loading || editText.trim() === ''" @click="saveNote">
                        Save
                    </button>
                </div>
            </template>

            <!-- Display mode -->
            <div v-else class="flex-1 overflow-hidden">
                <p v-if="note.text.trim()"
                    class="text-amber-900 font-handwriting text-base leading-relaxed whitespace-pre-wrap break-words">
                    {{ note.text }}
                </p>
                <p v-else class="text-amber-600/50 font-handwriting text-base italic">
                    {{ placeholder }}
                </p>
            </div>
        </div>

        <!-- Paper corner fold effect -->
        <div
            class="absolute top-0 right-0 w-4 h-4 bg-amber-200/40 transform rotate-45 translate-x-2 -translate-y-2 border-l border-b border-amber-300/30">
        </div>
    </div>
</template>

<script setup lang="ts">
interface Note {
    id: string
    text: string
    loading?: boolean
    error?: string | null
}

interface Props {
    note: Note
    placeholder?: string
    size?: 'sm' | 'md' | 'lg'
    onUpdate?: (id: string, text: string) => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Double-click to add a note...',
    size: 'md',
    onUpdate: undefined
})

const emit = defineEmits<{
    update: [id: string, text: string]
    retry: [id: string]
}>()

// Reactive state
const isEditing = ref(false)
const editText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

// Computed classes for different sizes
const stickyNoteClasses = computed(() => {
    const sizeClasses = {
        sm: 'w-48 h-32',
        md: 'w-64 h-40',
        lg: 'w-80 h-48'
    }

    return [
        sizeClasses[props.size],
        'transform transition-all duration-200',
        'hover:scale-105  ',
        'cursor-pointer select-none',
        {
            'scale-105 shadow-xl ': isEditing.value,
            'opacity-75 cursor-not-allowed': props.note.loading
        }
    ]
})

// Methods
const startEditing = () => {
    if (props.note.loading || props.note.error) return

    isEditing.value = true
    editText.value = props.note.text

    nextTick(() => {
        if (textareaRef.value) {
            textareaRef.value.focus()
            // Auto-resize textarea
            autoResizeTextarea()
        }
    })
}

const cancelEdit = () => {
    isEditing.value = false
    editText.value = ''
}

const saveNote = async () => {
    if (editText.value.trim() === props.note.text.trim()) {
        cancelEdit()
        return
    }

    try {
        if (props.onUpdate) {
            await props.onUpdate(props.note.id, editText.value.trim())
        }
        emit('update', props.note.id, editText.value.trim())
        isEditing.value = false
    } catch (error) {
        console.error('Failed to save note:', error)
        // Keep editing mode active on error
    }
}

const retry = () => {
    emit('retry', props.note.id)
}

const autoResizeTextarea = () => {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
        textareaRef.value.style.height = `${textareaRef.value.scrollHeight}px`
    }
}

// Watch for textarea content changes to auto-resize
watch(editText, () => {
    nextTick(autoResizeTextarea)
})
</script>

<style scoped>
.sticky-note {
    /* font-family: 'Kalam', 'Comic Sans MS', cursive, system-ui; */
}

.font-handwriting {
    /* font-family: 'Kalam', 'Comic Sans MS', cursive, system-ui; */
}

/* Custom paper texture effect */
.sticky-note::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
        radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
        radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
        radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 30px 30px, 25px 25px, 20px 20px;
    pointer-events: none;
    border-radius: 0.5rem;
}

/* Add a subtle lined paper effect */
.sticky-note::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: repeating-linear-gradient(transparent,
            transparent 23px,
            rgba(245, 158, 11, 0.2) 24px);
    pointer-events: none;
    border-radius: 0.5rem;
}
</style>
