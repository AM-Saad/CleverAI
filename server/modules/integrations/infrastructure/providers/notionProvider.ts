import type {
  BoardProvider,
  ExternalBoardItem,
  ProviderAccountContext,
} from "../../domain/boardProvider";
import type { WorkspaceProvider } from "../../domain/workspaceProvider";
import type {
  ExternalDocument,
  ExternalDocumentPage,
  ExternalSource,
  ExternalTask,
  ExternalTaskPage,
  PreviewWorkspaceImportResponse,
} from "../../../../../shared/utils/workspaceIntegration.contract";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2026-03-11";
export const NOTION_SHARED_PAGES_SOURCE_ID = "__notion_shared_pages__";
const BLOCK_DEPTH_LIMIT = 3;
const BLOCK_PAGE_LIMIT = 4;

function notionHeaders(account: ProviderAccountContext) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${account.accessToken}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      if (part && typeof part === "object" && "plain_text" in part) {
        return String((part as { plain_text?: string }).plain_text ?? "");
      }
      return "";
    })
    .join("");
}

function richTextHtml(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const text = escapeHtml(String(part?.plain_text ?? ""));
      const href = typeof part?.href === "string" ? part.href : null;
      return href
        ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${text}</a>`
        : text;
    })
    .join("");
}

function pickTitle(properties: Record<string, any>) {
  for (const property of Object.values(properties)) {
    if (property?.type === "title") {
      const title = plainText(property.title).trim();
      if (title) return title;
    }
  }
  return "Untitled";
}

function pickStatus(properties: Record<string, any>) {
  for (const property of Object.values(properties)) {
    if (property?.type === "status") return property.status?.name ?? null;
    if (property?.type === "select") return property.select?.name ?? null;
  }
  return null;
}

function pickTags(properties: Record<string, any>) {
  for (const property of Object.values(properties)) {
    if (property?.type === "multi_select") {
      return Array.isArray(property.multi_select)
        ? property.multi_select
          .map((option: { name?: string }) => option.name)
          .filter((name: string | undefined): name is string => Boolean(name))
        : [];
    }
  }
  return [];
}

function pickDate(properties: Record<string, any>) {
  for (const property of Object.values(properties)) {
    if (property?.type === "date") return property.date?.start ?? null;
  }
  return null;
}

function hasTaskLikeProperties(properties: Record<string, any>) {
  return Object.values(properties).some((property) =>
    ["status", "select", "multi_select", "date"].includes(property?.type),
  );
}

async function searchNotion(
  account: ProviderAccountContext,
  object: "page" | "data_source",
  pageSize: number,
) {
  return $fetch<{
    results?: Array<{
      id: string;
      object: string;
      title?: unknown[];
      name?: string;
      url?: string;
      last_edited_time?: string;
      properties?: Record<string, any>;
    }>;
  }>(`${NOTION_API_BASE}/search`, {
    method: "POST",
    headers: notionHeaders(account),
    body: {
      filter: { property: "object", value: object },
      page_size: pageSize,
    },
  });
}

async function queryNotionSource(
  account: ProviderAccountContext,
  sourceId: string,
  limit: number,
) {
  const body = { page_size: limit };
  try {
    return await $fetch<{
      results?: Array<{
        id: string;
        url?: string;
        last_edited_time?: string;
        properties?: Record<string, any>;
      }>;
    }>(`${NOTION_API_BASE}/data_sources/${sourceId}/query`, {
      method: "POST",
      headers: notionHeaders(account),
      body,
    });
  } catch (error: any) {
    const status = error?.response?.status || error?.status || error?.statusCode;
    if (status && status !== 404) throw error;
    return $fetch<{
      results?: Array<{
        id: string;
        url?: string;
        last_edited_time?: string;
        properties?: Record<string, any>;
      }>;
    }>(`${NOTION_API_BASE}/databases/${sourceId}/query`, {
      method: "POST",
      headers: notionHeaders(account),
      body,
    });
  }
}

async function fetchBlockChildren(
  account: ProviderAccountContext,
  blockId: string,
  depth = 0,
) {
  if (depth > BLOCK_DEPTH_LIMIT) return [];

  const results: any[] = [];
  let cursor: string | undefined;
  let pagesFetched = 0;

  do {
    const response = await $fetch<{
      results?: any[];
      has_more?: boolean;
      next_cursor?: string | null;
    }>(`${NOTION_API_BASE}/blocks/${blockId}/children`, {
      method: "GET",
      headers: notionHeaders(account),
      query: {
        page_size: 50,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });
    results.push(...(response.results ?? []));
    cursor = response.has_more && response.next_cursor
      ? response.next_cursor
      : undefined;
    pagesFetched += 1;
  } while (cursor && pagesFetched < BLOCK_PAGE_LIMIT);

  return results;
}

async function blockToHtml(
  account: ProviderAccountContext,
  block: any,
  depth: number,
  warnings: string[],
): Promise<string> {
  const type = block?.type;
  const value = block?.[type] ?? {};
  const text = richTextHtml(value.rich_text);
  let body = "";

  switch (type) {
    case "paragraph":
      body = text ? `<p>${text}</p>` : "";
      break;
    case "heading_1":
      body = `<h1>${text || "Untitled"}</h1>`;
      break;
    case "heading_2":
      body = `<h2>${text || "Untitled"}</h2>`;
      break;
    case "heading_3":
      body = `<h3>${text || "Untitled"}</h3>`;
      break;
    case "bulleted_list_item":
      body = `<ul><li>${text}</li></ul>`;
      break;
    case "numbered_list_item":
      body = `<ol><li>${text}</li></ol>`;
      break;
    case "to_do":
      body = `<p><input type="checkbox" disabled${value.checked ? " checked" : ""}> ${text}</p>`;
      break;
    case "quote":
      body = `<blockquote>${text}</blockquote>`;
      break;
    case "code":
      body = `<pre><code>${escapeHtml(plainText(value.rich_text))}</code></pre>`;
      break;
    case "divider":
      body = "<hr>";
      break;
    case "child_page":
      body = `<p><strong>Linked page:</strong> ${escapeHtml(value.title ?? "Untitled")}</p>`;
      break;
    case "bookmark":
    case "embed":
    case "link_preview":
      body = value.url
        ? `<p><a href="${escapeHtml(value.url)}" target="_blank" rel="noreferrer">${escapeHtml(value.url)}</a></p>`
        : "";
      break;
    case "image":
    case "file":
    case "pdf":
    case "video":
    case "audio":
      warnings.push(`Skipped Notion ${type} content that cannot be imported as text.`);
      body = `<p><em>Unsupported Notion ${escapeHtml(type)} block. Open the source page to view it.</em></p>`;
      break;
    default:
      if (type) warnings.push(`Skipped unsupported Notion block: ${type}.`);
      body = text ? `<p>${text}</p>` : "";
      break;
  }

  if (block?.has_children && depth < BLOCK_DEPTH_LIMIT) {
    try {
      const children = await fetchBlockChildren(account, block.id, depth + 1);
      const childHtml = await blocksToHtml(account, children, depth + 1, warnings);
      return `${body}${childHtml}`;
    } catch {
      warnings.push("Some nested Notion content could not be read. Check page permissions.");
    }
  }

  return body;
}

async function blocksToHtml(
  account: ProviderAccountContext,
  blocks: any[],
  depth: number,
  warnings: string[],
) {
  const html = await Promise.all(
    blocks.map((block) => blockToHtml(account, block, depth, warnings)),
  );
  return html.filter(Boolean).join("\n");
}

async function pageToDocument(
  account: ProviderAccountContext,
  page: {
    id: string;
    url?: string;
    last_edited_time?: string;
    properties?: Record<string, any>;
  },
  warnings: string[],
): Promise<ExternalDocument> {
  let htmlContent = "";
  try {
    const blocks = await fetchBlockChildren(account, page.id);
    htmlContent = await blocksToHtml(account, blocks, 0, warnings);
  } catch {
    warnings.push(`Could not read content for Notion page "${pickTitle(page.properties ?? {})}".`);
  }

  const title = pickTitle(page.properties ?? {});
  return {
    provider: "notion",
    externalId: page.id,
    externalUrl: page.url ?? null,
    title,
    htmlContent: htmlContent || "<p><em>No readable Notion content was found.</em></p>",
    plainText: title,
    updatedAt: page.last_edited_time ?? null,
    metadata: { object: "page" },
    raw: page as unknown as Record<string, unknown>,
  };
}

function pageToTask(page: {
  id: string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, any>;
}): ExternalTask {
  const properties = page.properties ?? {};
  return {
    provider: "notion",
    externalId: page.id,
    externalKey: undefined,
    externalUrl: page.url ?? null,
    title: pickTitle(properties),
    status: pickStatus(properties),
    tags: pickTags(properties),
    dueDate: pickDate(properties),
    updatedAt: page.last_edited_time ?? null,
    raw: page as unknown as Record<string, unknown>,
  };
}

export class NotionWorkspaceProvider implements WorkspaceProvider {
  provider = "notion" as const;

  async listSources(account: ProviderAccountContext): Promise<ExternalSource[]> {
    const [dataSourceResponse, pageResponse] = await Promise.all([
      searchNotion(account, "data_source", 50),
      searchNotion(account, "page", 1),
    ]);

    const sources: ExternalSource[] = (dataSourceResponse.results ?? []).map((source) => {
      const properties = source.properties ?? {};
      const taskLike = hasTaskLikeProperties(properties);
      return {
        provider: this.provider,
        accountId: account.id,
        id: source.id,
        name: source.name || plainText(source.title) || "Untitled source",
        url: source.url ?? null,
        supportedKinds: ["TASK", "DOCUMENT"],
        defaultTarget: taskLike ? "BOARD_ITEM" : "NOTE",
        metadata: {
          object: source.object,
          taskLike,
        },
      };
    });

    if ((pageResponse.results ?? []).length > 0) {
      sources.unshift({
        provider: this.provider,
        accountId: account.id,
        id: NOTION_SHARED_PAGES_SOURCE_ID,
        name: "Shared Notion pages",
        url: null,
        supportedKinds: ["DOCUMENT"],
        defaultTarget: "NOTE",
        metadata: { object: "page_collection" },
      });
    }

    return sources;
  }

  async listTasks(input: {
    account: ProviderAccountContext;
    sourceId: string;
    limit: number;
  }): Promise<ExternalTaskPage> {
    if (input.sourceId === NOTION_SHARED_PAGES_SOURCE_ID) {
      return {
        items: [],
        warnings: ["Shared Notion pages import into Notes, not Board tasks."],
      };
    }

    const response = await queryNotionSource(
      input.account,
      input.sourceId,
      input.limit,
    );
    return {
      items: (response.results ?? []).map(pageToTask),
      warnings: [],
    };
  }

  async listDocuments(input: {
    account: ProviderAccountContext;
    sourceId: string;
    limit: number;
  }): Promise<ExternalDocumentPage> {
    const warnings: string[] = [];
    const pages = input.sourceId === NOTION_SHARED_PAGES_SOURCE_ID
      ? (await searchNotion(input.account, "page", input.limit)).results ?? []
      : (await queryNotionSource(input.account, input.sourceId, input.limit)).results ?? [];

    const items: ExternalDocument[] = [];
    for (const page of pages.slice(0, input.limit)) {
      items.push(await pageToDocument(input.account, page, warnings));
    }

    return { items, warnings };
  }

  async previewSource(input: {
    account: ProviderAccountContext;
    sourceId: string;
    limit: number;
    targetType?: string | null;
    contentKinds?: string[];
  }): Promise<PreviewWorkspaceImportResponse> {
    const warnings: string[] = [];
    const wantsTasks =
      input.targetType === "BOARD_ITEM" || input.contentKinds?.includes("TASK");
    const wantsDocuments =
      input.targetType === "NOTE" ||
      input.contentKinds?.includes("DOCUMENT") ||
      !wantsTasks;

    const [tasks, documents] = await Promise.all([
      wantsTasks ? this.listTasks(input) : Promise.resolve({ items: [], warnings: [] }),
      wantsDocuments
        ? this.listDocuments({ ...input, limit: Math.min(input.limit, 5) })
        : Promise.resolve({ items: [], warnings: [] }),
    ]);

    warnings.push(...tasks.warnings, ...documents.warnings);
    return {
      tasks: tasks.items,
      documents: documents.items.map((doc) => ({
        provider: doc.provider,
        externalId: doc.externalId,
        externalKey: doc.externalKey,
        externalUrl: doc.externalUrl,
        title: doc.title,
        plainText: doc.plainText,
        updatedAt: doc.updatedAt,
        metadata: doc.metadata,
        excerpt: doc.htmlContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180),
      })),
      warnings,
    };
  }

}

export class NotionBoardProvider implements BoardProvider {
  provider = "notion" as const;
  private readonly workspaceProvider = new NotionWorkspaceProvider();

  async listSources(account: ProviderAccountContext) {
    return this.workspaceProvider.listSources(account);
  }

  async listItems(input: {
    account: ProviderAccountContext;
    sourceId: string;
    limit: number;
  }): Promise<ExternalBoardItem[]> {
    const page = await this.workspaceProvider.listTasks(input);
    return page.items.map((item) => ({
      ...item,
      externalKey: item.externalKey ?? undefined,
    }));
  }
}
