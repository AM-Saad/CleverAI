<template>
  <div class="min-h-screen bg-background text-content-on-surface flex flex-col items-center justify-center p-6">
    <ui-card
      variant="default"
      size="xl"
      shadow="md"
      class-name="w-full max-w-lg"
      content-classes="space-y-6"
    >
      <!-- Header -->
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-full bg-accent-orange/10 text-accent-orange">
          <UiIcon name="i-lucide-share-2" class="h-6 w-6" />
        </div>
        <div>
          <ui-title tag="h1" size="xl" weight="semibold">Content Received</ui-title>
          <p class="text-xs text-content-secondary">Received content via OS Share Sheet</p>
        </div>
      </div>

      <!-- Preview Box -->
      <ui-card variant="surface" size="sm" shadow="none" content-classes="space-y-2">
        <div v-if="sharedTitle" class="text-sm font-semibold text-content-primary">
          {{ sharedTitle }}
        </div>
        <div v-if="sharedUrl" class="text-xs text-accent-blue truncate">
          🔗 {{ sharedUrl }}
        </div>
        <div v-if="sharedText" class="text-sm text-content-secondary line-clamp-4 whitespace-pre-wrap italic">
          "{{ sharedText }}"
        </div>
        <div v-if="fileName" class="text-xs text-success-text flex items-center gap-1">
          <UiIcon name="i-lucide-file-text" class="h-4 w-4" /> {{ fileName }}
        </div>
      </ui-card>

      <!-- Quick Action Buttons -->
      <div class="space-y-3">
        <ui-button
          tone="primary"
          class="w-full justify-center"
          icon="i-lucide-sparkles"
          :loading="creating"
          @click="generateFlashcards"
        >
          Generate AI Flashcards & Quiz
        </ui-button>

        <ui-button
          tone="neutral"
          variant="soft"
          class="w-full justify-center"
          icon="i-lucide-bookmark"
          @click="captureAsWord"
        >
          Capture as Word / Note
        </ui-button>

        <ui-button
          tone="neutral"
          variant="ghost"
          class="w-full justify-center"
          icon="i-lucide-calendar"
          @click="addToToday"
        >
          Add to Today's Plan
        </ui-button>
      </div>

      <div class="text-center">
        <ui-button variant="link" tone="neutral" size="sm" @click="cancel">
          Cancel and return home
        </ui-button>
      </div>
    </ui-card>
  </div>
</template>

<script setup lang="ts">
import { useHaptics } from "~/composables/pwa/useHaptics"
import { useActiveWorkspace } from "~/composables/workspaces/useActiveWorkspace"

// Guest shares must not be dropped by the global auth redirect — see app/middleware/auth.global.ts.
definePageMeta({ auth: false })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const haptics = useHaptics()
const { $api } = useNuxtApp()
const { activeId } = useActiveWorkspace()
const creating = ref(false)

const sharedText = computed(() => (route.query.text as string) || '')
const sharedUrl = computed(() => (route.query.url as string) || '')
const sharedTitle = computed(() => (route.query.title as string) || '')
const fileName = computed(() => (route.query.fileName as string) || '')

onMounted(() => {
  haptics.success()
  toast.add({
    title: 'Content Captured',
    description: 'Choose how you would like to study this shared item.',
    color: 'success',
    icon: 'i-lucide-share-2',
  })
})

const generateFlashcards = async () => {
  haptics.selection()
  if (!activeId.value) {
    toast.add({
      title: 'No workspace found',
      description: 'Open Materials once to set up a workspace, then share again.',
      color: 'error',
    })
    return
  }
  const content = [sharedText.value, sharedUrl.value].filter(Boolean).join('\n')
  creating.value = true
  try {
    const res = await $api.materials.create({
      workspaceId: activeId.value,
      title: sharedTitle.value || sharedText.value.slice(0, 60) || 'Shared content',
      content: content || sharedTitle.value || 'Shared content',
      type: 'text',
    })
    if (res.success) {
      router.push({ path: `/materials/${res.data.id}`, query: { openGenerate: '1' } })
    } else {
      toast.add({ title: 'Could not save shared content', description: 'Sign in and try again.', color: 'error' })
    }
  } catch {
    toast.add({ title: 'Could not save shared content', description: 'Sign in and try again.', color: 'error' })
  } finally {
    creating.value = false
  }
}

const captureAsWord = () => {
  haptics.selection()
  const payload = sharedText.value || sharedTitle.value || sharedUrl.value
  router.push({
    path: '/notes',
    query: { action: 'quick-capture', initialValue: payload }
  })
}

const addToToday = () => {
  haptics.selection()
  const taskText = sharedTitle.value || sharedText.value.slice(0, 80) || sharedUrl.value
  router.push({
    path: '/day',
    query: { addTask: taskText }
  })
}

const cancel = () => {
  haptics.light()
  router.push('/')
}
</script>
