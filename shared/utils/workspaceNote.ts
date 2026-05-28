const FIRST_HEADING_PATTERN = /^(\s*)<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\2>/i;
const TITLE_FALLBACK = "Untitled note";
const DEFAULT_WORKSPACE_NOTE_HTML = "<h1></h1><p></p>";
const BODY_HEADING_PATTERN = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
const PARAGRAPH_PATTERN = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
const EMPTY_PARAGRAPH_PATTERN = /^\s*(?:<br\s*\/?>)?\s*$/i;

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

function isEmptyParagraphContent(content: string): boolean {
  return EMPTY_PARAGRAPH_PATTERN.test(content);
}

function isSingleCharacterParagraphContent(content: string): boolean {
  const plainText = stripHtml(content);
  return Array.from(plainText).length === 1;
}

function repairFragmentedSingleCharacterParagraphs(html: string): string {
  const paragraphs = Array.from(html.matchAll(PARAGRAPH_PATTERN));
  if (paragraphs.length < 4) return html;

  let repaired = "";
  let cursor = 0;

  for (let index = 0; index < paragraphs.length;) {
    const paragraph = paragraphs[index];
    if (!paragraph?.index && paragraph?.index !== 0) break;

    const run: RegExpMatchArray[] = [];
    let nextIndex = index;
    let singleCharacterCount = 0;

    while (nextIndex < paragraphs.length) {
      const candidate = paragraphs[nextIndex];
      if (!candidate?.index && candidate?.index !== 0) break;

      const between = html.slice(
        nextIndex === index ? paragraph.index : (paragraphs[nextIndex - 1]!.index! + paragraphs[nextIndex - 1]![0].length),
        candidate.index,
      );
      if (between.trim()) break;

      const content = candidate[1] ?? "";
      if (isSingleCharacterParagraphContent(content)) {
        singleCharacterCount += 1;
        run.push(candidate);
        nextIndex += 1;
        continue;
      }

      if (run.length > 0 && isEmptyParagraphContent(content)) {
        run.push(candidate);
        nextIndex += 1;
        continue;
      }

      break;
    }

    if (singleCharacterCount >= 4) {
      const runStart = run[0]!.index!;
      const runEnd = run[run.length - 1]!.index! + run[run.length - 1]![0].length;
      const mergedText = run
        .map((item) => stripHtml(item[1] ?? ""))
        .filter(Boolean)
        .join("");

      repaired += html.slice(cursor, runStart);
      repaired += `<p>${mergedText}</p>`;
      cursor = runEnd;
      index = nextIndex;
      continue;
    }

    index += 1;
  }

  repaired += html.slice(cursor);
  return repaired;
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

  const body = trimmed.slice(headingMatch[0].length).replace(
    BODY_HEADING_PATTERN,
    (_match, level: string, attrs: string, bodyHeadingContent: string) => {
      const plainText = stripHtml(bodyHeadingContent);
      if (!plainText) return "<p></p>";
      return level === "1"
        ? `<h2${attrs}>${bodyHeadingContent}</h2>`
        : `<h${level}${attrs}>${bodyHeadingContent}</h${level}>`;
    },
  );

  return `${normalizedHeading}${repairFragmentedSingleCharacterParagraphs(body)}`;
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
