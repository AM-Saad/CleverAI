<template>
    <!-- Parent container: reserves space in grid -->
    <div ref="noteRef" :class="noteContainerClasses">
        <!-- Child: handles animation and positioning -->
        <div :class="noteContentClasses" @click="startEditing" oncontextmenu.prevent="startEditing">
            <!-- Paper-like background with shadow and texture -->
            <div
                class="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded shadow-lg transform" />

            <!-- Content area -->
            <div class="relative p-4 h-full flex flex-col transition-opacity duration-400" :class="{
                'opacity-0': isAnimating,
                'opacity-100': !isAnimating,
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
                    <button v-if="!isEditing && note.text.trim()"
                        class="md:opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                        :aria-label="isFullscreen ? 'Exit fullscreen' : 'View fullscreen'"
                        @click="$emit('toggleFullscreen', note.id)">
                        <svg v-if="isFullscreen" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                    </button>
                    <UButton v-if="!note.loading && !isFullscreen"
                        class="md:opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity duration-200 text-amber-600 hover:text-amber-800 cursor-pointer"
                        :class="{ 'opacity-0': note.loading }" variant="soft" color="error" size="xs" :disabled="false"
                        @click="deleteNote(note.id)">
                        <icon name="i-heroicons-trash" class="w-3 h-3" />
                    </UButton>

                    <!-- Edit icon (only show when not editing and not loading) -->
                    <button v-if="!isEditing"
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
                <div
                    class="mb-2 pb-2 border-b border-amber-200/40 animate-pulse repeat-infinite ease-in-out opacity-75">
                    <p class="text-[10px] text-amber-600/70">Auto-saving...</p>
                </div>
                <client-only>
                    <div ref="editorContainerRef" class="w-full h-full">
                        <shared-tiptap-editor ref="tiptapRef" :id="note.id" v-model="contentHtml"
                            :isFullScreen="isFullscreen" />
                    </div>
                </client-only>
                <!-- Auto-save hint -->

                <!-- Display mode -->
                <!-- <div class="flex-1 overflow-hidden">
                    <div v-if="note.text.trim()"
                        class="text-amber-900 font-handwriting text-base leading-relaxed whitespace-pre-wrap break-words"
                        v-html="note.text" />
                    <p v-else class="text-amber-600/50 font-handwriting text-base italic">
                        {{ placeholder }}
                    </p>
                </div> -->
            </div>

            <!-- Paper corner fold effect -->
            <!-- <div class="absolute top-0 right-0 w-4 h-4 bg-amber-200/40 transform  border-l border-b border-amber-300/30" /> -->
        </div>
    </div>
</template>

<script setup lang="ts">
import { watch } from "vue";
import type { Editor as TiptapEditorType } from "@tiptap/core";

interface Note {
    id: string;
    text: string;
    loading?: boolean;
    error?: string | null;
}

interface Props {
    note: Note;
    placeholder?: string;
    size?: "sm" | "md" | "lg";
    isFullscreen?: boolean;
    deleteNote: (id: string) => void;
    onUpdate?: (id: string, text: string) => Promise<void> | void;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "Double-click to add a note...",
    size: "md",
    isFullscreen: false,
    onUpdate: undefined,
});

const emit = defineEmits<{
    update: [id: string, text: string];
    retry: [id: string];
    toggleFullscreen: [id: string];
}>();

// Reactive state
const isEditing = ref(false);
const contentHtml = ref(props.note.text); // HTML content for tiptap v-model
const originalText = ref(props.note.text); // To track changes for saving
const tiptapRef = ref<{ editor?: TiptapEditorType } | null>(null);
const editorContainerRef = ref<HTMLElement | null>(null);
const noteRef = ref<HTMLElement>();
const isAnimating = ref(false);

// Debounced auto-save function
const { debouncedFunc: debouncedSave, cancel: cancelSave } = useDebounce(
    (text: string) => {
        saveNote(text);
    },
    800, // 800ms delay
);

// Computed classes for parent container
const noteContainerClasses = computed(() => {
    const sizeClasses = {
        sm: "w-48 h-32",
        md: "w-64 h-40",
        lg: "w-full h-48",
    };

    const baseClasses = [
        "note-container",
        sizeClasses[props.size],
        "transition-all duration-100",
    ];

    return [
        ...baseClasses,
        { "opacity-75": props.note.loading && !props.isFullscreen },
    ];
});

// Computed classes for the note content
const noteContentClasses = computed(() => {
    const baseClasses = [
        "note-content",
        "w-full h-full",
        "cursor-pointer select-none",
        "transition-all duration-100",
        "relative",
    ];

    const normalClasses = [
        "hover:scale-105",
        {
            "scale-105 shadow-xl": isEditing.value,
            "pointer-events-none": props.note.loading,
            "opacity-0": isAnimating.value && !props.isFullscreen,
            invisible: isAnimating.value && !props.isFullscreen,
        },
    ];

    return [...baseClasses, ...normalClasses];
});

// Animation helper for fullscreen transition
const animateToFullscreen = (element: HTMLElement) => {
    isAnimating.value = true;
    const rect = element.getBoundingClientRect();

    // Apply the animation starting from current position
    element.style.position = "fixed";
    element.style.top = `${rect.top}px`;
    element.style.left = `${rect.left}px`;
    element.style.width = "600px";
    element.style.minWidth = "600px";
    element.style.height = "600px";
    element.style.maxWidth = "90vw";
    element.style.maxHeight = "90vh";
    element.style.zIndex = "1000";
    element.style.opacity = "1";
    element.style.visibility = "visible";

    // Trigger the animation on next frame
    requestAnimationFrame(() => {
        element.style.top = "50%";
        element.style.left = "50%";
        element.style.transform = "translate(-50%, -50%)";
        // element.style.width = '400px'
        // element.style.height = '400px'

        // End animation state after transition completes and show content
        setTimeout(() => {
            isAnimating.value = false;
        }, 500); // Match the CSS transition duration
    });
};

const animateFromFullscreen = (element: HTMLElement) => {
    isAnimating.value = true;

    // Reset to relative positioning
    element.style.position = "relative";
    element.style.top = "auto";
    element.style.left = "auto";
    element.style.width = "100%";
    element.style.height = "100%";
    element.style.minWidth = "unset";
    element.style.minHeight = "unset";
    element.style.maxWidth = "unset";
    element.style.maxHeight = "unset";
    element.style.transform = "unset";
    element.style.zIndex = "auto";
    element.style.opacity = "";
    element.style.visibility = "";

    // End animation state after transition completes
    setTimeout(() => {
        isAnimating.value = false;
    }, 500); // Match the CSS transition duration
};

// Watch for fullscreen changes and animate
watch(
    () => props.isFullscreen,
    (isFullscreen) => {
        if (!noteRef.value) return;

        const noteContentElement = noteRef.value.querySelector(
            ".note-content",
        ) as HTMLElement;
        if (!noteContentElement) return;

        if (isFullscreen) {
            animateToFullscreen(noteContentElement);
        } else {
            animateFromFullscreen(noteContentElement);
        }
    },
);

// Methods
// Simple synchronous sanitizer using DOMParser (safe for basic XSS trimming)
const sanitizeHtml = (html = "") => {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style").forEach((n) => n.remove());
    doc.querySelectorAll("*").forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
            if (
                attr.name === "href" &&
                attr.value.trim().toLowerCase().startsWith("javascript:")
            ) {
                el.removeAttribute("href");
            }
        }
    });
    // Allow only a white-list set of tags/attrs by reconstructing innerHTML
    // For now, return cleaned innerHTML
    return doc.body.innerHTML.trim();
};

const startEditing = () => {
    if (props.note.loading || props.note.error || isEditing.value) return;
    console.log("Starting to edit note:", props.note.id);
    isEditing.value = true;
    // note.text now contains HTML
    originalText.value = props.note.text;
    contentHtml.value = props.note.text || "";

    // nextTick(() => {
    //     // Focus tiptap editor if available
    //     if (tiptapRef.value?.editor?.commands?.focus) {
    //         tiptapRef.value.editor.commands.focus()
    //     }
    // })

    setTimeout(() => {
        // Focus tiptap editor if available
        if (tiptapRef.value?.editor?.commands?.focus) {
            console.log("Focusing tiptap editor for note:", props.note.id);
            tiptapRef.value.editor.commands.focus();
        }
    }, 1000);
};

const cancelEdit = () => {
    // revert to original HTML
    contentHtml.value = originalText.value || "";
    isEditing.value = false;
    cancelSave();
};

const softFinishEditing = () => {
    console.log("Soft-finishing edit for note:", props.note.id);
    const sanitized = sanitizeHtml(contentHtml.value);
    if (sanitized !== (originalText.value || "").trim()) {
        cancelSave();
        void saveNote(sanitized);
    }
};

// Auto-finish editing when clicking outside or after a period of inactivity
const autoFinishEditing = () => {
    console.log("Auto-finishing edit for note:", props.note.id);
    const sanitized = sanitizeHtml(contentHtml.value);
    if (sanitized !== (originalText.value || "").trim()) {
        cancelSave();
        void saveNote(sanitized);
    }
    isEditing.value = false;
};

const saveNote = async (html: string) => {
    console.log("Saving note:", props.note.id);
    const sanitized = sanitizeHtml(html);
    if (sanitized === (originalText.value || "").trim()) return;

    try {
        if (props.onUpdate) {
            await props.onUpdate(props.note.id, sanitized);
        }
        emit("update", props.note.id, sanitized);
        originalText.value = sanitized;
    } catch {
        console.error("Failed to save note:");
        // Don't close editing mode on error so user can retry
    }
};

const retry = () => {
    emit("retry", props.note.id);
};

// Watch for tiptap content changes to auto-save (we persist plain text)
watch(contentHtml, (newHtml) => {
    if (!isEditing.value) return;
    const sanitized = sanitizeHtml(newHtml);
    if (sanitized !== (originalText.value || "").trim()) {
        debouncedSave(sanitized);
    }
});

// Handle click outside to finish editing
const handleClickOutside = (event: MouseEvent) => {
    event.stopPropagation();
    if (!isEditing.value) return;
    console.log("Handling click outside for note:", props.note.id);
    const target = event.target as Node;
    const container = editorContainerRef.value;
    if (container && !container.contains(target)) {
        autoFinishEditing();
    }
};

const handleKeydown = (event: KeyboardEvent) => {
    if (!isEditing.value) return;
    if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        softFinishEditing();
    }
};

// Add/remove click outside listener
watch(isEditing, (editing) => {
    if (editing) {
        document.addEventListener("click", handleClickOutside);
        document.addEventListener("keydown", handleKeydown);
    } else {
        document.removeEventListener("click", handleClickOutside);
        document.removeEventListener("keydown", handleKeydown);
    }
});

// Clean up event listener on unmount
onBeforeUnmount(() => {
    document.removeEventListener("click", handleClickOutside);
    document.removeEventListener("keydown", handleKeydown);
});
</script>

<style scoped>
/* Note container - reserves space in grid layout */
.note-container {
    position: relative;
}

/* Note content - handles animations and positioning */
.note-content {
    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
    border: 1px solid #f59e0b20;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Custom paper texture effect */
.note-content::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
        radial-gradient(circle at 20% 80%,
            rgba(255, 255, 255, 0.1) 1px,
            transparent 1px),
        radial-gradient(circle at 80% 20%,
            rgba(255, 255, 255, 0.1) 1px,
            transparent 1px),
        radial-gradient(circle at 40% 40%,
            rgba(255, 255, 255, 0.05) 1px,
            transparent 1px);
    background-size:
        30px 30px,
        25px 25px,
        20px 20px;
    pointer-events: none;
    border-radius: 0.5rem;
}

/* Fullscreen animation styles handled by JavaScript */

/* Add a subtle lined paper effect */
.sticky-note::after {
    content: "";
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
