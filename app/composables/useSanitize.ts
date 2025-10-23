import DOMPurify from 'dompurify'

/**
 * Composable for sanitizing user-generated HTML content
 * Prevents XSS attacks by removing dangerous scripts and attributes
 */
export function useSanitize() {
  /**
   * Sanitize HTML content for safe rendering
   * Allows common formatting tags but removes scripts, event handlers, etc.
   */
  function sanitizeHtml(dirty: string | undefined | null): string {
    if (!dirty) return ''

    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        // Headings
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        // Text formatting
        'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'small', 'del', 'ins',
        // Lists
        'ul', 'ol', 'li',
        // Quotes and code
        'blockquote', 'code', 'pre',
        // Links and images
        'a', 'img',
        // Tables
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        // Misc
        'div', 'span', 'hr',
      ],
      ALLOWED_ATTR: [
        'href', 
        'src', 
        'alt', 
        'title', 
        'class',
        'target',
        'rel',
      ],
      // Only allow safe URL schemes
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      // Additional security options
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SAFE_FOR_TEMPLATES: true,
    })
  }

  /**
   * Strip all HTML and return plain text only
   * Useful for fields that should never contain HTML
   */
  function sanitizeText(dirty: string | undefined | null): string {
    if (!dirty) return ''
    
    // Use DOMPurify to strip all tags
    return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [] })
  }

  /**
   * Sanitize and truncate text to a maximum length
   * Useful for previews and summaries
   */
  function sanitizeAndTruncate(
    dirty: string | undefined | null,
    maxLength: number = 200,
    suffix: string = '...'
  ): string {
    const sanitized = sanitizeText(dirty)
    if (sanitized.length <= maxLength) return sanitized
    return sanitized.slice(0, maxLength - suffix.length).trim() + suffix
  }

  return {
    sanitizeHtml,
    sanitizeText,
    sanitizeAndTruncate,
  }
}
