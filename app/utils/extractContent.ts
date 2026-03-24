// Helper function to extract content from workspace materials
// This should replace rawText usage throughout the application

interface WorkspaceLike {
  materials?: Array<{
    title?: string
    content?: string
  }>
  rawText?: string | null
}

/**
 * Extract text content from workspace materials for LLM generation
 * Falls back to legacy rawText for backward compatibility
 */
export function extractContentFromWorkspace(workspace: WorkspaceLike | null | undefined): string | undefined {
  if (!workspace) return undefined

  // Priority 1: Use materials if available
  if (workspace.materials && Array.isArray(workspace.materials) && workspace.materials.length > 0) {
    // Combine all material content with titles as separators
    return workspace.materials
      .map((material) => `${material.title || 'Material'}\n\n${material.content || ''}`)
      .join('\n\n---\n\n')
  }

  // Priority 2: Fall back to legacy rawText for backward compatibility
  return workspace.rawText || undefined
}
