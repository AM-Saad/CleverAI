<template>
    <!-- Parent container: reserves space in grid -->
    <div 
        ref="noteRef"
        :class="noteContainerClasses">
        
        <!-- Child: handles animation and positioning -->
        <div 
            :class="noteContentClasses"
            @dblclick="startEditing">
            
            <!-- Paper-like background with shadow and texture -->
            <div class="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded shadow-lg transform " />

        <!-- Content area -->
        <div 
            class="relative p-4 h-full flex flex-col transition-opacity duration-200"
            :class="{
                'opacity-0': isAnimating,
                'opacity-100': !isAnimating
            }">
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

                <!-- Fullscreen toggle button (show when not loading and has content) -->
                <button 
                    v-else-if="!isEditing && note.text.trim()"
                    class="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                    :aria-label="isFullscreen ? 'Exit fullscreen' : 'View fullscreen'" 
                    @click="$emit('toggleFullscreen', note.id)">
                    <svg v-if="isFullscreen" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path 
                            stroke-linecap="round" 
                            stroke-linejoin="round" 
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path 
                            stroke-linecap="round" 
                            stroke-linejoin="round" 
                            stroke-width="2"
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>

                <!-- Edit icon (only show when not editing and not loading) -->
                <button 
                    v-else-if="!isEditing"
                    class="opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                    aria-label="Edit note" 
                    @click="startEditing">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path 
                            stroke-linecap="round" 
                            stroke-linejoin="round" 
                            stroke-width="2"
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
                  <div class="mb-2 pb-2 border-t border-amber-200/40">
                    <p class="text-xs text-amber-600/70">
                        Auto-saving...
                    </p>
                    <!-- <p class="text-xs text-amber-600/70 text-center">
                        Auto-saving... Press <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Esc</kbd> to
                        cancel, <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Cmd</kbd>+<kbd
                            class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded">Enter</kbd> to save
                        immediately.
                    </p> -->
                </div>
                <textarea 
                    ref="textareaRef" 
                    v-model="editText"
                    class="w-full h-full resize-none bg-transparent border-none outline-none text-amber-900 placeholder-amber-600/50 font-handwriting text-base leading-relaxed p-0"
                    :placeholder="placeholder" 
                    :disabled="false" 
                    @keydown.esc="cancelEdit"
                    @keydown.ctrl.enter="softFinishEditing" 
                    @keydown.meta.enter="softFinishEditing" />

                <!-- Auto-save hint -->
              
            </template>

            <!-- Display mode -->
            <div v-else class="flex-1 overflow-hidden">
                <p 
                    v-if="note.text.trim()"
                    class="text-amber-900 font-handwriting text-base leading-relaxed whitespace-pre-wrap break-words">
                    {{ note.text }}
                </p>
                <p v-else class="text-amber-600/50 font-handwriting text-base italic">
                    {{ placeholder }}
                </p>
            </div>
        </div>

        <!-- Paper corner fold effect -->
        <!-- <div class="absolute top-0 right-0 w-4 h-4 bg-amber-200/40 transform  border-l border-b border-amber-300/30" /> -->
        </div>
    </div>
</template>

<script setup lang="ts">
import { useDebounce } from '~/utils/debounce'
import { watch } from 'vue'

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
    isFullscreen?: boolean
    onUpdate?: (id: string, text: string) => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: 'Double-click to add a note...',
    size: 'md',
    isFullscreen: false,
    onUpdate: undefined
})

const emit = defineEmits<{
    update: [id: string, text: string]
    retry: [id: string]
    toggleFullscreen: [id: string]
}>()

// Reactive state
const isEditing = ref(false)
const editText = ref('')
const originalText = ref('')
const textareaRef = ref<HTMLTextAreaElement>()
const noteRef = ref<HTMLElement>()
const isAnimating = ref(false)

// Debounced auto-save function
const { debouncedFunc: debouncedSave, cancel: cancelSave } = useDebounce(
    (text: string) => {
        saveNote(text)
    },
    800 // 800ms delay
)

// Computed classes for parent container
const noteContainerClasses = computed(() => {
    const sizeClasses = {
        sm: 'w-48 h-32',
        md: 'w-64 h-40',
        lg: 'w-full h-48'
    }

    const baseClasses = [
        'note-container',
        sizeClasses[props.size],
        'transition-all duration-1000'
    ]

    return [
        ...baseClasses,
        { 'opacity-75': props.note.loading }
    ]
})

// Computed classes for the note content
const noteContentClasses = computed(() => {
    const baseClasses = [
        'note-content',
        'w-full h-full',
        'cursor-pointer select-none',
        'transition-all duration-1000',
        'relative'
    ]

    const normalClasses = [
        'hover:scale-105',
        {
            'scale-105 shadow-xl': isEditing.value,
            'pointer-events-none': props.note.loading,
            'opacity-0': isAnimating.value && !props.isFullscreen,
            'invisible': isAnimating.value && !props.isFullscreen
        }
    ]

    const fullscreenClasses = [
        'fullscreen-note'
    ]

    return [
        ...baseClasses,
        ...(props.isFullscreen ? fullscreenClasses : normalClasses)
    ]
})

// Animation helper for fullscreen transition
const animateToFullscreen = (element: HTMLElement) => {
    isAnimating.value = true
    const rect = element.getBoundingClientRect()
    
    // Apply the animation starting from current position
    element.style.position = 'fixed'
    element.style.top = `${rect.top}px`
    element.style.left = `${rect.left}px`
    // element.style.width = `${rect.width}px`
    // element.style.height = `${rect.height}px`
           element.style.width = '400px'
        element.style.height = '400px'
    element.style.zIndex = '1000'
    element.style.opacity = '1'
    element.style.visibility = 'visible'
    
    // Trigger the animation on next frame
    requestAnimationFrame(() => {
        element.style.top = '50%'
        element.style.left = '50%'
        element.style.transform = 'translate(-50%, -50%) scale(1.3)'
        // element.style.width = '400px'
        // element.style.height = '400px'
        
        // End animation state after transition completes and show content
        setTimeout(() => {
            isAnimating.value = false
        }, 500) // Match the CSS transition duration
    })
}

const animateFromFullscreen = (element: HTMLElement) => {
    isAnimating.value = true
    
    // Reset to relative positioning
    element.style.position = 'relative'
    element.style.top = 'auto'
    element.style.left = 'auto'
    element.style.width = '100%'
    element.style.height = '100%'
    element.style.transform = 'none'
    element.style.zIndex = 'auto'
    element.style.opacity = ''
    element.style.visibility = ''
    
    // End animation state after transition completes
    setTimeout(() => {
        isAnimating.value = false
    }, 500) // Match the CSS transition duration
}

// Watch for fullscreen changes and animate
watch(() => props.isFullscreen, (isFullscreen) => {
    if (!noteRef.value) return
    
    const noteContentElement = noteRef.value.querySelector('.note-content') as HTMLElement
    if (!noteContentElement) return
    
    if (isFullscreen) {
        animateToFullscreen(noteContentElement)
    } else {
        animateFromFullscreen(noteContentElement)
    }
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
/* Note container - reserves space in grid layout */
.note-container {
    position: relative;
    margin: 8px;
}

/* Note content - handles animations and positioning */
.note-content {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b20;
    border-radius: 8px;
    box-shadow: 
        0 4px 6px -1px rgba(0, 0, 0, 0.1),
        0 2px 4px -1px rgba(0, 0, 0, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    font-family: 'Kalam', cursive;
    position: relative;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Custom paper texture effect */
.note-content::before {
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

/* Fullscreen animation styles handled by JavaScript */

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
