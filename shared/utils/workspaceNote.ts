const FIRST_HEADING_PATTERN = /^(\s*)<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\2>/i;
const TITLE_FALLBACK = "Untitled note";
const DEFAULT_WORKSPACE_NOTE_HTML = "<h1></h1><p></p>";

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = String(entity).toLowerCase();

    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
    }

    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWorkspaceNoteContent(content?: string | null): string {
  const trimmed = content?.trim() ?? "";

  if (!trimmed) {
    return DEFAULT_WORKSPACE_NOTE_HTML;
  }

  const headingMatch = trimmed.match(FIRST_HEADING_PATTERN);
  if (!headingMatch) {
    return `<h1></h1>${trimmed}`;
  }

  const [, leadingWhitespace, , attributes, headingContent] = headingMatch;
  const normalizedHeading = `${leadingWhitespace}<h1${attributes}>${headingContent}</h1>`;

  return trimmed.replace(FIRST_HEADING_PATTERN, normalizedHeading);
}

export function extractWorkspaceNoteTitle(content?: string | null): string {
  const normalizedContent = normalizeWorkspaceNoteContent(content);
  const headingMatch = normalizedContent.match(FIRST_HEADING_PATTERN);
  const headingText = headingMatch?.[4] ? stripHtml(headingMatch[4]) : "";

  return headingText || TITLE_FALLBACK;
}

export function normalizeWorkspaceNoteTitle(
  title?: string | null,
  content?: string | null,
): string {
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  return extractWorkspaceNoteTitle(content);
}

export { DEFAULT_WORKSPACE_NOTE_HTML, TITLE_FALLBACK };