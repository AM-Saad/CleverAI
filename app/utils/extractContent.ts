// Helper function to extract content from folder materials
// This should replace rawText usage throughout the application

interface FolderLike {
  materials?: Array<{
    title?: string
    content?: string
  }>
  rawText?: string | null
}

/**
 * Extract text content from folder materials for LLM generation
 * Falls back to legacy rawText for backward compatibility
 */
export function extractContentFromFolder(folder: FolderLike | null | undefined): string | undefined {
  if (!folder) return undefined

  // Priority 1: Use materials if available
  if (folder.materials && Array.isArray(folder.materials) && folder.materials.length > 0) {
    // Combine all material content with titles as separators
    return folder.materials
      .map((material) => `${material.title || 'Material'}\n\n${material.content || ''}`)
      .join('\n\n---\n\n')
  }

  // Priority 2: Fall back to legacy rawText for backward compatibility
  return folder.rawText || undefined
}
