import type { ReviewCard } from '~/shared/utils/review.contract'

/**
 * Composable for handling polymorphic card display logic
 * Supports both flashcard and material resource types
 */
export const useCardDisplay = (card: Ref<ReviewCard | null>) => {
  /**
   * Get the front/question content based on resource type
   * - Flashcard: returns 'front' field
   * - Material: returns 'title' field
   */
  const resourceFront = computed(() => {
    const c = card.value
    if (!c) return ''
    
    if (c.resourceType === 'flashcard') {
      const flashcardResource = c.resource as {
        front: string
        back: string
        folderId: string
        hint?: string
        tags?: string[]
      }
      return flashcardResource.front
    }
    
    const materialResource = c.resource as {
      title: string
      content: string
      folderId: string
      tags?: string[]
    }
    return materialResource.title
  })

  /**
   * Get the back/answer content based on resource type
   * - Flashcard: returns 'back' field
   * - Material: returns 'content' field
   */
  const resourceBack = computed(() => {
    const c = card.value
    if (!c) return ''
    
    if (c.resourceType === 'flashcard') {
      const flashcardResource = c.resource as {
        front: string
        back: string
        folderId: string
        hint?: string
        tags?: string[]
      }
      return flashcardResource.back
    }
    
    const materialResource = c.resource as {
      title: string
      content: string
      folderId: string
      tags?: string[]
    }
    return materialResource.content
  })

  /**
   * Get the hint content (only available for flashcards)
   * Returns undefined for materials
   */
  const resourceHint = computed(() => {
    const c = card.value
    if (!c) return undefined
    
    if (c.resourceType === 'flashcard') {
      const flashcardResource = c.resource as {
        front: string
        back: string
        folderId: string
        hint?: string
        tags?: string[]
      }
      return flashcardResource.hint
    }
    
    return undefined
  })

  /**
   * Get badge CSS class based on resource type
   */
  const resourceTypeBadgeClass = computed(() => {
    if (!card.value) return ''
    return card.value.resourceType === 'flashcard'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  })

  /**
   * Get icon name based on resource type
   */
  const resourceTypeIcon = computed(() => {
    if (!card.value) return 'heroicons:document'
    return card.value.resourceType === 'flashcard'
      ? 'heroicons:rectangle-stack'
      : 'heroicons:document-text'
  })

  /**
   * Get formatted resource type label
   */
  const resourceTypeLabel = computed(() => {
    if (!card.value) return ''
    return card.value.resourceType === 'flashcard' ? 'Flashcard' : 'Material'
  })

  return {
    resourceFront,
    resourceBack,
    resourceHint,
    resourceTypeBadgeClass,
    resourceTypeIcon,
    resourceTypeLabel,
  }
}
