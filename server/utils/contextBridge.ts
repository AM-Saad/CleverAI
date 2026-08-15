/**
 * Content preprocessing utilities for Context Bridge feature
 * Injects markers into content before LLM processing
 */

export interface PdfPageRange {
  page: number;
  start: number;
  end: number;
}

export function joinPdfPageText(pages: Array<{ num: number; text: string }>): {
  text: string;
  pageRanges: PdfPageRange[];
} {
  let text = "";
  const pageRanges: PdfPageRange[] = [];

  for (const page of pages) {
    if (text) text += "\n\n";
    const start = text.length;
    text += page.text;
    pageRanges.push({ page: page.num, start, end: text.length });
  }

  return { text, pageRanges };
}

export function parsePdfPageRanges(value: unknown): PdfPageRange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ranges = value.filter(
    (range): range is PdfPageRange =>
      Boolean(range) &&
      Number.isInteger(range.page) &&
      Number.isInteger(range.start) &&
      Number.isInteger(range.end) &&
      range.page > 0 &&
      range.start >= 0 &&
      range.end >= range.start,
  );
  return ranges.length ? ranges : undefined;
}

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
  pageCount?: number,
  pageRanges?: PdfPageRange[],
): string {
  if (!content) return "";

  const validRanges = pageRanges?.filter(
    (range) => range.start < content.length && range.end <= content.length,
  );
  if (validRanges?.length) {
    return validRanges
      .map(
        (range) =>
          `[[PAGE:${range.page}]]\n${content.substring(range.start, range.end)}`,
      )
      .join("\n\n");
  }

  // Legacy uploads stored only page count, so retain their old best-effort fallback.
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
  materialId?: string,
): {
  type: string;
  anchor: string;
  materialId?: string;
  contextSnippet?: string;
} | null {
  if (!sourceMetadata?.anchor) return null;

  return {
    type: sourceType,
    anchor: sourceMetadata.anchor,
    ...(materialId && { materialId }),
    ...(sourceMetadata.contextSnippet?.trim() && {
      contextSnippet: sourceMetadata.contextSnippet.trim(),
    }),
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
