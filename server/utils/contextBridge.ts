/**
 * Content preprocessing utilities for Context Bridge feature
 * Injects markers into content before LLM processing
 */

/**
 * Inject [[BLOCK_ID:xyz]] markers into note content
 * Splits by paragraphs and adds markers at the start of each block
 */
export function injectNoteBlockMarkers(content: string): string {
  if (!content) return "";

  // Split by double newlines (paragraphs)
  const blocks = content.split(/\n\n+/);

  return blocks
    .map((block, index) => {
      const blockId = `block-${index}`;
      return `[[BLOCK_ID:${blockId}]]\n${block}`;
    })
    .join("\n\n");
}

/**
 * Inject [[PAGE:n]] markers into PDF content
 * Assumes content is already split by pages or uses heuristics
 */
export function injectPdfPageMarkers(
  content: string,
  pageCount?: number
): string {
  if (!content) return "";

  // If pageCount is provided, split content into equal chunks
  if (pageCount && pageCount > 1) {
    const chunkSize = Math.ceil(content.length / pageCount);
    const chunks: string[] = [];

    for (let i = 0; i < pageCount; i++) {
      const start = i * chunkSize;
      const end = Math.min((i + 1) * chunkSize, content.length);
      const chunk = content.substring(start, end);
      chunks.push(`[[PAGE:${i + 1}]]\n${chunk}`);
    }

    return chunks.join("\n\n");
  }

  // Otherwise, treat as single page
  return `[[PAGE:1]]\n${content}`;
}

/**
 * Extract source metadata from LLM response
 * Parses the source_metadata field and converts it to sourceRef format
 */
export function extractSourceRef(
  sourceMetadata: { anchor: string; contextSnippet?: string } | undefined,
  sourceType: "NOTE" | "PDF",
  materialId?: string
): { type: string; anchor: string; materialId?: string } | null {
  if (!sourceMetadata?.anchor) return null;

  return {
    type: sourceType,
    anchor: sourceMetadata.anchor,
    ...(materialId && { materialId }),
  };
}

/**
 * Remove markers from content (for display purposes)
 */
export function stripMarkers(content: string): string {
  return content
    .replace(/\[\[BLOCK_ID:[^\]]+\]\]\n?/g, "")
    .replace(/\[\[PAGE:\d+\]\]\n?/g, "");
}
