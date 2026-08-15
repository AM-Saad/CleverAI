import { createError } from "h3";
import formidable, { type Fields, type Files, type Part } from "formidable";
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import type { PDFParse as PdfParser } from "pdf-parse";
import { requireRole } from "~~/server/utils/auth";
import { z } from "zod";
import { estimateTokensFromText } from "@server/utils/llm/tokenEstimate";
import {
  joinPdfPageText,
  type PdfPageRange,
} from "@server/utils/contextBridge";

const UploadRequestSchema = z.object({
  workspaceId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Workspace ID must be a valid ObjectId"),
  title: z.string().trim().min(1).max(240).optional(),
});

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Sanitize extracted text
 * - Remove excessive blank lines
 * - Trim whitespace
 * - Remove common headers/footers patterns
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/gm, "") // Trim each line
    .replace(/Page \d+ of \d+/gi, "") // Remove page numbers
    .trim();
}

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(buffer: Buffer): Promise<{
  text: string;
  pageCount?: number;
  pageRanges: PdfPageRange[];
}> {
  let parser: PdfParser | undefined;
  try {
    // pdf-parse v2+ uses PDFParse class, not a function
    const { PDFParse } = await import("pdf-parse");

    parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const joined = joinPdfPageText(
      textResult.pages.map((page) => ({
        num: page.num,
        text: sanitizeText(page.text),
      })),
    );

    return {
      text: joined.text,
      pageCount: textResult.total,
      pageRanges: joined.pageRanges,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw createError({
      statusCode: 400,
      statusMessage:
        "Failed to extract text from PDF. The file may be corrupted or password-protected.",
    });
  } finally {
    await parser?.destroy();
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractDocxText(buffer: Buffer): Promise<{ text: string }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: sanitizeText(result.value),
    };
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw createError({
      statusCode: 400,
      statusMessage:
        "Failed to extract text from DOCX. The file may be corrupted.",
    });
  }
}

/**
 * Extract text from TXT buffer
 */
function extractTxtText(buffer: Buffer): { text: string } {
  return {
    text: sanitizeText(buffer.toString("utf-8")),
  };
}

export default defineEventHandler(async (event) => {
  const prisma = event.context.prisma;
  // Auth check
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;

  // Parse multipart form data
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    filter: (part: Part) => {
      const ext = path.extname(part.originalFilename || "").toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    },
  });

  const [fields, files] = await new Promise<[Fields, Files]>(
    (resolve, reject) => {
      form.parse(
        event.node.req,
        (err: Error | null, fields: Fields, files: Files) => {
          if (err) reject(err);
          else resolve([fields, files]);
        },
      );
    },
  );

  // Validate fields
  const parsedFields = UploadRequestSchema.safeParse({
    workspaceId: Array.isArray(fields.workspaceId)
      ? fields.workspaceId[0]
      : fields.workspaceId,
    title: Array.isArray(fields.title) ? fields.title[0] : fields.title,
  });
  if (!parsedFields.success) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid upload details",
      data: parsedFields.error.issues,
    });
  }
  const { workspaceId, title } = parsedFields.data;

  // Get uploaded file
  const fileArray = files.file;
  if (!fileArray || fileArray.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "No file uploaded",
    });
  }

  const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
  if (!file) {
    throw createError({
      statusCode: 400,
      statusMessage: "No file uploaded",
    });
  }
  const ext = path.extname(file.originalFilename || "").toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    });
  }

  // Verify workspace ownership
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { userId: true },
  });

  if (!workspace || workspace.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Workspace not found or access denied",
    });
  }

  // Read file buffer
  const buffer = await fs.readFile(file.filepath);

  // Extract text based on file type
  let extractedText = "";
  let pageCount: number | undefined;
  let pageRanges: PdfPageRange[] | undefined;

  if (ext === ".pdf") {
    const pdfResult = await extractPdfText(buffer);
    extractedText = pdfResult.text;
    pageCount = pdfResult.pageCount;
    pageRanges = pdfResult.pageRanges;
  } else if (ext === ".docx") {
    const docxResult = await extractDocxText(buffer);
    extractedText = docxResult.text;
  } else if (ext === ".txt") {
    const txtResult = extractTxtText(buffer);
    extractedText = txtResult.text;
  } else {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    });
  }

  // Validate extracted text
  if (!extractedText || extractedText.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Extracted text is too short. The file may be empty or unreadable.",
    });
  }

  // Limit text length (100k chars = ~28k tokens), and disclose that reduction
  // in both the stored metadata and response.
  const MAX_CHARS = 100000;
  const originalCharCount = extractedText.length;
  const truncated = originalCharCount > MAX_CHARS;
  if (truncated) {
    extractedText = extractedText.substring(0, MAX_CHARS);
    pageRanges = pageRanges
      ?.filter((range) => range.start < MAX_CHARS)
      .map((range) => ({ ...range, end: Math.min(range.end, MAX_CHARS) }));
  }

  // Estimate tokens
  const tokenEstimate = estimateTokensFromText(extractedText);
  const charCount = extractedText.length;

  // Save material with token metadata for analytics and avoiding recomputation
  const material = await prisma.material.create({
    data: {
      workspaceId,
      title: title || file.originalFilename || "Uploaded Document",
      content: extractedText,
      type: ext.substring(1), // Remove dot: .pdf -> pdf
      metadata: {
        tokenEstimate,
        charCount,
        originalCharCount,
        truncated,
        pageCount: pageCount ?? null,
        ...(pageRanges?.length && {
          pageRanges: pageRanges.map(({ page, start, end }) => ({
            page,
            start,
            end,
          })),
        }),
      },
    },
  });

  // Cleanup temp file
  try {
    await fs.unlink(file.filepath);
  } catch (error) {
    console.warn("Failed to cleanup temp file:", error);
  }

  return {
    materialId: material.id,
    tokenEstimate,
    charCount: extractedText.length,
    originalCharCount,
    truncated,
    pageCount,
    title: material.title,
  };
});
