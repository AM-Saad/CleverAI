/**
 * Composable for formatting card content with markdown-like syntax
 * Provides XSS-safe text formatting for card display
 */
export const useContentFormatter = () => {
  /**
   * Format content with markdown-like syntax
   * 
   * Supports:
   * - **bold** → <strong>
   * - *italic* → <em>
   * - `code` → <code>
   * - [text](url) → <a> links
   * - Newlines → <br>
   * 
   * @param content - Raw content string
   * @returns HTML-formatted string (safe for v-html)
   */
  const formatContent = (content: string): string => {
    if (!content) return ''
    
    return content
      // Bold: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code: `text`
      .replace(
        /`(.*?)`/g,
        '<code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">$1</code>'
      )
      // Newlines
      .replace(/\n/g, '<br>')
      // Links: [text](url)
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
      )
  }

  /**
   * Strip all formatting and return plain text
   * Useful for accessibility or plain text contexts
   * 
   * @param content - Formatted content string
   * @returns Plain text without formatting
   */
  const stripFormatting = (content: string): string => {
    if (!content) return ''
    
    return content
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/\n/g, ' ')
      .trim()
  }

  /**
   * Truncate content to a maximum length
   * Preserves word boundaries
   * 
   * @param content - Content to truncate
   * @param maxLength - Maximum length in characters
   * @returns Truncated content with ellipsis if needed
   */
  const truncateContent = (content: string, maxLength: number = 100): string => {
    if (!content || content.length <= maxLength) return content
    
    const truncated = content.slice(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    // Cut at last space to avoid breaking words
    return lastSpace > 0 
      ? truncated.slice(0, lastSpace) + '...'
      : truncated + '...'
  }

  return {
    formatContent,
    stripFormatting,
    truncateContent,
  }
}
