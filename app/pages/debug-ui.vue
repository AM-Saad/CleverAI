<template>
    <div class="container mx-auto p-8 space-y-8">
        <h1 class="text-2xl font-bold">UI Component Testing - Buttons & Inputs</h1>

        <!-- Button Design Section -->
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-blue-600 border-b border-blue-200 pb-2">🎨 UButton Design System</h2>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Default UButton Variants</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton>Default Button</UButton>
                    <UButton variant="solid" size="sm">Solid Button</UButton>
                    <UButton variant="outline">Outline Button</UButton>
                    <UButton variant="soft">Soft Button</UButton>
                    <UButton variant="ghost">Ghost Button</UButton>
                    <UButton variant="link">Link Button</UButton>
                </div>
            </div>


            <div class="space-y-4">
                <h3 class="text-xl font-semibold">UButton with UI Prop Overrides</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton
:ui="{
                        base: 'focus:outline-none focus-visible:outline-0 disabled:cursor-not-allowed disabled:opacity-75 flex-shrink-0',
                        font: 'font-bold',
                        rounded: 'rounded-xl',
                        size: {
                            md: 'text-sm px-6 py-3'
                        },
                        color: {
                            primary: {
                                solid: 'shadow-sm ring-1 ring-inset ring-blue-500 text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500'
                            }
                        }
                    }" color="primary" variant="solid">
                        Custom Primary
                    </UButton>

                    <UButton
:ui="{
                        color: {
                            orange: {
                                solid: 'shadow-sm ring-1 ring-inset ring-orange-500 text-white bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 focus-visible:ring-2 focus-visible:ring-orange-500'
                            }
                        }
                    }" color="orange" variant="solid">
                        Custom Orange
                    </UButton>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Button Sizes</h3>
                <div class="flex flex-wrap items-center gap-4">
                    <UButton size="xs">Extra Small</UButton>
                    <UButton size="sm">Small</UButton>
                    <UButton size="md">Medium</UButton>
                    <UButton size="lg">Large</UButton>
                    <UButton size="xl">Extra Large</UButton>
                </div>
            </div>


            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Interactive Button Examples</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton
                        class="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-150"
                        @click="buttonClicked">
                        Click Me! ({{ clickCount }})
                    </UButton>

                    <UButton
:disabled="isLoading"
                        class="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold  px-8 rounded-xl transition-colors duration-200 "
                        @click="simulateLoading">
                        <span v-if="!isLoading">Load Data</span>
                        <span v-else class="flex items-center gap-2">
                            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle
class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4" />
                                <path
class="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Loading...
                        </span>
                    </UButton>
                </div>
            </div>

        </div>

        <!-- Input Section (Previous Content) -->
        <div class="space-y-6 border-t border-gray-200 pt-8">
            <h2 class="text-2xl font-bold text-green-600 border-b border-green-200 pb-2">🎯 UInput Design System</h2>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">✅ Working Solution: GreenInput Component</h2>
                <GreenInput v-model="testValue5" placeholder="This uses our custom GreenInput component" />
                <p class="text-sm text-green-600 font-medium">✅ This should have green borders!</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Default UInput (should have green border from app.config.ts)</h2>
                <UInput v-model="testValue" placeholder="This should have green border from app.config.ts" />
                <p class="text-sm text-gray-600">Test: Type something to see focus state</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">UInput with explicit green border class</h2>
                <UInput
v-model="testValue2" placeholder="This has explicit border-green-500 class"
                    class="!border-green-500 !focus:border-green-600" />
                <p class="text-sm text-gray-600">Test: This should definitely be green</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">UInput with ui prop override</h2>
                <UInput
v-model="testValue4" placeholder="UI prop override test"
                    :ui="{ variant: { outline: 'shadow-sm bg-white text-gray-900 ring-1 ring-inset ring-green-500 focus:ring-2 focus:ring-green-600' } }"
                    variant="outline" />
                <p class="text-sm text-gray-600">Test: Using ui prop to override styling with ring classes</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">🎯 UInput with working ring classes</h2>
                <UInput
v-model="testValue6" placeholder="This should work with ring classes"
                    class="ring-1 ring-green-500 focus:ring-2 focus:ring-green-600" />
                <p class="text-sm text-green-600">Test: Using ring classes directly (Nuxt UI style)</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Regular HTML input with Tailwind green border</h2>
                <input
v-model="testValue3" placeholder="Plain HTML input with green border"
                    class="border border-green-500 px-3 py-2 rounded focus:border-green-600 focus:outline-none w-full">
                <p class="text-sm text-gray-600">Test: This should definitely show green to confirm Tailwind works</p>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">How to Use Green Styling</h2>
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 class="font-medium text-green-800 mb-2">Three Options Available:</h3>
                    <ol class="list-decimal list-inside text-sm text-green-700 space-y-1">
                        <li><strong>Use GreenInput component:</strong> <code>&lt;GreenInput v-model="value" /&gt;</code>
                        </li>
                        <li><strong>Use ui prop:</strong>
                            <code>&lt;UInput :ui="{ variant: { outline: 'ring-green-300 focus:ring-green-500' } }" /&gt;</code>
                        </li>
                        <li><strong>Use CSS classes:</strong> <code>&lt;UInput class="!border-green-500" /&gt;</code>
                        </li>
                    </ol>
                </div>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Inspect Elements</h2>
                <div class="bg-gray-100 p-4 rounded">
                    <p class="text-sm">Open browser dev tools and inspect the UInput elements above</p>
                    <p class="text-sm">Look for:</p>
                    <ul class="text-sm list-disc ml-4">
                        <li>Applied CSS classes on the input elements</li>
                        <li>Whether app.config.ts styles are being loaded</li>
                        <li>Any CSS conflicts or overrides</li>
                    </ul>
                </div>
            </div>

            <div class="space-y-4">
                <h2 class="text-xl font-semibold">Current app.config.ts UI values</h2>
                <details class="bg-gray-100 p-4 rounded">
                    <summary class="cursor-pointer font-medium">Click to show config</summary>
                    <pre class="text-xs mt-2">{{ JSON.stringify(appConfig.ui, null, 2) }}</pre>
                </details>
            </div>
        </div> <!-- Close Input Section -->

        <!-- Sticky Notes Section -->
        <div class="space-y-6 border-t border-gray-200 pt-8">
            <h2 class="text-2xl font-bold text-purple-600 border-b border-purple-200 pb-2">📝 Sticky Notes Component
            </h2>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Interactive Sticky Notes</h3>
                <p class="text-sm text-gray-600">Double-click or use the edit icon to edit notes. Try different states!
                </p>

                <div class="flex flex-wrap gap-6 p-4 bg-gray-50 rounded-lg">
                    <!-- Default note -->
                    <ui-sticky-note :note="sampleNotes.default" @update="updateNote" @retry="retryNote" />

                    <!-- Small note with text -->
                    <ui-sticky-note :note="sampleNotes.small" size="sm" @update="updateNote" @retry="retryNote" />

                    <!-- Large note -->
                    <ui-sticky-note
:note="sampleNotes.large" size="lg" placeholder="Add your thoughts here..."
                        @update="updateNote" @retry="retryNote" />

                    <!-- Loading state -->
                    <ui-sticky-note :note="sampleNotes.loading" @update="updateNote" @retry="retryNote" />

                    <!-- Error state -->
                    <ui-sticky-note :note="sampleNotes.error" @update="updateNote" @retry="retryNote" />

                    <!-- Dynamically added notes -->
                    <ui-sticky-note
v-for="note in dynamicNotes" :key="note.id" :note="note" @update="updateNote"
                        @retry="retryNote" />
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Component Features</h3>
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <ul class="list-disc list-inside text-sm text-purple-700 space-y-1">
                        <li><strong>Paper-like Design:</strong> Realistic sticky note appearance with shadows and
                            texture</li>
                        <li><strong>Double-click to Edit:</strong> Quick access to edit mode</li>
                        <li><strong>Edit Icon:</strong> Hover to reveal edit button</li>
                        <li><strong>Multiple Sizes:</strong> sm, md, lg variants</li>
                        <li><strong>Loading State:</strong> Shows spinner when saving</li>
                        <li><strong>Error Handling:</strong> Displays errors with retry option</li>
                        <li><strong>Keyboard Shortcuts:</strong> Ctrl/Cmd+Enter to save, Esc to cancel</li>
                        <li><strong>Auto-resize:</strong> Textarea adjusts to content</li>
                    </ul>
                </div>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Usage Example</h3>
                <details class="bg-gray-100 p-4 rounded">
                    <summary class="cursor-pointer font-medium">Click to show code example</summary>
                    <pre class="text-xs mt-2 overflow-x-auto"><code>&lt;StickyNote
  :note="{
    id: 'note-1',
    text: 'My note text',
    loading: false,
    error: null
  }"
  size="md"
  placeholder="Add your note..."
  @update="handleUpdate"
  @retry="handleRetry"
/&gt;</code></pre>
                </details>
            </div>

            <div class="space-y-4">
                <h3 class="text-xl font-semibold">Actions</h3>
                <div class="flex flex-wrap gap-4">
                    <UButton variant="solid" color="primary" @click="addNewNote">
                        Add New Note
                    </UButton>
                    <UButton variant="outline" color="red" @click="simulateError">
                        Simulate Error
                    </UButton>
                    <UButton variant="outline" color="blue" @click="simulateLoadingAction">
                        Simulate Loading
                    </UButton>
                    <UButton variant="ghost" color="gray" @click="resetNotes">
                        Reset All Notes
                    </UButton>
                </div>
            </div>
        </div> <!-- Close Sticky Notes Section -->
    </div> <!-- Close Container -->
</template>

<script setup>
// Input test values
const testValue = ref('')
const testValue2 = ref('')
const testValue3 = ref('')
const testValue4 = ref('')
const testValue5 = ref('')
const testValue6 = ref('')

// Button interaction state
const clickCount = ref(0)
const isLoading = ref(false)

// Sticky Notes state
const sampleNotes = ref({
    default: {
        id: 'note-1',
        text: '',
        loading: false,
        error: null
    },
    small: {
        id: 'note-2',
        text: 'Quick reminder: Call dentist on Monday',
        loading: false,
        error: null
    },
    large: {
        id: 'note-3',
        text: 'Meeting Notes:\n- Discuss project timeline\n- Review budget requirements\n- Plan next sprint\n- Update stakeholders',
        loading: false,
        error: null
    },
    loading: {
        id: 'note-4',
        text: 'This note is being saved...',
        loading: true,
        error: null
    },
    error: {
        id: 'note-5',
        text: 'Failed to save this note',
        loading: false,
        error: 'Network connection failed. Please try again.'
    }
})

let noteCounter = 6

// Computed property to get dynamically added notes (excluding the predefined ones)
const dynamicNotes = computed(() => {
    const staticKeys = ['default', 'small', 'large', 'loading', 'error']
    return Object.entries(sampleNotes.value)
        .filter(([key]) => !staticKeys.includes(key))
        .map(([, note]) => note)
})

// Button interaction methods
const buttonClicked = () => {
    clickCount.value++
}

const simulateLoading = async () => {
    isLoading.value = true
    await new Promise(resolve => setTimeout(resolve, 2000))
    isLoading.value = false
}

// Sticky Notes methods
const updateNote = async (id, text) => {
    console.log('Updating note:', id, text)

    // Find the note and update it
    for (const key in sampleNotes.value) {
        if (sampleNotes.value[key].id === id) {
            sampleNotes.value[key].loading = true
            sampleNotes.value[key].error = null

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Random chance of failure for demo
            if (Math.random() < 0.2) {
                sampleNotes.value[key].loading = false
                sampleNotes.value[key].error = 'Failed to save. Please try again.'
                return
            }

            sampleNotes.value[key].text = text
            sampleNotes.value[key].loading = false
            break
        }
    }
}

const retryNote = async (id) => {
    console.log('Retrying note:', id)

    // Find the note and retry
    for (const key in sampleNotes.value) {
        if (sampleNotes.value[key].id === id) {
            const currentText = sampleNotes.value[key].text
            sampleNotes.value[key].error = null
            await updateNote(id, currentText)
            break
        }
    }
}

const addNewNote = () => {
    const newNoteId = `note-${noteCounter++}`
    const newKey = `dynamic-${noteCounter}`

    sampleNotes.value[newKey] = {
        id: newNoteId,
        text: '',
        loading: false,
        error: null
    }
}

const simulateError = () => {
    // Set the first note to error state
    sampleNotes.value.default.error = 'Simulated error occurred!'
    sampleNotes.value.default.loading = false
}

const simulateLoadingAction = () => {
    // Set the first note to loading state
    sampleNotes.value.default.loading = true
    sampleNotes.value.default.error = null

    setTimeout(() => {
        sampleNotes.value.default.loading = false
    }, 3000)
}

const resetNotes = () => {
    sampleNotes.value = {
        default: {
            id: 'note-1',
            text: '',
            loading: false,
            error: null
        },
        small: {
            id: 'note-2',
            text: 'Quick reminder: Call dentist on Monday',
            loading: false,
            error: null
        },
        large: {
            id: 'note-3',
            text: 'Meeting Notes:\n- Discuss project timeline\n- Review budget requirements\n- Plan next sprint\n- Update stakeholders',
            loading: false,
            error: null
        },
        loading: {
            id: 'note-4',
            text: 'This note is being saved...',
            loading: true,
            error: null
        },
        error: {
            id: 'note-5',
            text: 'Failed to save this note',
            loading: false,
            error: 'Network connection failed. Please try again.'
        }
    }
    noteCounter = 6
}

const appConfig = useAppConfig()
console.log('app.config.ts → ui:', appConfig.ui)
console.log('app.config.ts → name:', appConfig.name)

console.log(useAppConfig().ui.button)
</script>
