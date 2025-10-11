<template>
    <div class="sticky-note w-full relative group" :class="[
        stickyNoteClasses,
        { 'pointer-events-none': note.loading }
    ]" @dblclick="startEditing">
        <!-- Paper-like background with shadow and texture -->
        <div
            class="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded shadow-lg transform  opacity-60" />

        <!-- Content area -->
        <div class="relative p-4 h-full flex flex-col">
            <!-- Top right indicators -->
            <div class="absolute top-2 right-2 flex items-center gap-1">
                <!-- Tiny saving indicator -->
                <div v-if="note.loading" class="flex items-center gap-1 text-amber-600">
                    <svg class="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path class="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>

                <!-- Edit icon (only show when not editing and not loading) -->
                <button v-else-if="!isEditing"
                    class="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                    aria-label="Edit note" @click="startEditing">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            </div>

            <!-- Error state -->
            <div v-if="note.error" class="flex flex-col items-center justify-center h-full text-red-600">
                <svg class="w-6 h-6 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-sm font-medium text-center">{{ note.error }}</span>
                <button class="mt-2 text-xs text-danger hover:text-red-700 underline" @click="retry">
                    Try again
                </button>
            </div>

            <!-- Edit mode -->
            <template v-else-if="isEditing">
                <textarea ref="textareaRef" v-model="editText"
                    class="w-full h-full resize-none bg-transparent border-none outline-none text-amber-900 placeholder-amber-600/50 font-handwriting text-base leading-relaxed p-0"
                    :placeholder="placeholder" :disabled="false" @keydown.esc="cancelEdit"
                    @keydown.ctrl.enter="softFinishEditing" @keydown.meta.enter="softFinishEditing" />

                <!-- Auto-save hint -->
                <div class="mt-2 pt-2 border-t border-amber-200/40">
                    <p class="text-xs text-amber-600/70 text-center">
                        Auto-saving... Press <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Esc</kbd> to
                        cancel, <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Cmd</kbd>+<kbd
                            class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Enter</kbd> to save
                        immediately.
                    </p>
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
        <div class="absolute top-0 right-0 w-4 h-4 bg-amber-200/40 transform  border-l border-b border-amber-300/30" />
    </div>
</template>

<script setup lang="ts">
import { useDebounce } from '~/utils/debounce'

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
const originalText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()

// Debounced auto-save function
const { debouncedFunc: debouncedSave, cancel: cancelSave } = useDebounce(
    (text: string) => {
        saveNote(text)
    },
    800 // 800ms delay
)

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
        'hover:scale-105',
        'cursor-pointer select-none',
        {
            'scale-105 shadow-xl': isEditing.value,
            'opacity-75 cursor-not-allowed': props.note.loading
        }
    ]
})

// Methods
const startEditing = () => {
    if (props.note.loading || props.note.error) return

    isEditing.value = true
    editText.value = props.note.text
    originalText.value = props.note.text

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
    editText.value = originalText.value
    cancelSave() // Cancel any pending save
}

const softFinishEditing = () => {
    // Finish editing without immediately closing edit mode
    // This allows for keyboard shortcuts without interrupting typing
    if (editText.value.trim() !== originalText.value.trim()) {
        cancelSave() // Cancel debounced save
        saveNote(editText.value.trim())
    }
}

// Auto-finish editing when clicking outside or after a period of inactivity
const autoFinishEditing = () => {
    if (editText.value.trim() !== originalText.value.trim()) {
        cancelSave() // Cancel debounced save
        saveNote(editText.value.trim())
    }
    isEditing.value = false
}

const saveNote = async (text: string) => {
    if (text === originalText.value.trim()) return

    try {
        if (props.onUpdate) {
            await props.onUpdate(props.note.id, text)
        }
        emit('update', props.note.id, text)
        originalText.value = text
    } catch (error) {
        console.error('Failed to save note:', error)
        // Don't close editing mode on error so user can retry
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

// Watch for textarea content changes to auto-resize and auto-save
watch(editText, (newText) => {
    nextTick(autoResizeTextarea)

    // Only auto-save if we're editing and text is different from original
    if (isEditing.value && newText.trim() !== originalText.value.trim()) {
        debouncedSave(newText.trim())
    }
})

// Handle click outside to finish editing
const handleClickOutside = (event: MouseEvent) => {
    if (isEditing.value && textareaRef.value && !textareaRef.value.contains(event.target as Node)) {
        autoFinishEditing()
    }
}

// Add/remove click outside listener
watch(isEditing, (editing) => {
    if (editing) {
        document.addEventListener('click', handleClickOutside)
    } else {
        document.removeEventListener('click', handleClickOutside)
    }
})

// Clean up event listener on unmount
onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
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
