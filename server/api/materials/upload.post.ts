import { createError } from "h3";
import formidable, { type Fields, type Files, type Part } from "formidable";
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { requireRole } from "~~/server/utils/auth";
import { z } from "zod";
import { estimateTokensFromText } from "@server/utils/llm/tokenEstimate";

const UploadRequestSchema = z.object({
  folderId: z.string(),
  title: z.string().optional(),
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
async function extractPdfText(
  buffer: Buffer
): Promise<{ text: string; pageCount?: number }> {
  try {
    // pdf-parse v2+ uses PDFParse class, not a function
    const { PDFParse } = await import("pdf-parse");

    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();
    await parser.destroy();

    return {
      text: sanitizeText(textResult.text),
      pageCount: infoResult.total,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw createError({
      statusCode: 400,
      statusMessage:
        "Failed to extract text from PDF. The file may be corrupted or password-protected.",
    });
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
      form.parse(event.node.req, (err: Error | null, fields: Fields, files: Files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    }
  );

  // Validate fields
  const folderId = Array.isArray(fields.folderId) ? fields.folderId[0] : fields.folderId;
  const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;

  if (!folderId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'folderId is required',
    });
  }

  // Get uploaded file
  const fileArray = files.file;
  if (!fileArray || fileArray.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    });
  }

  const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;
  const ext = path.extname(file.originalFilename || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    });
  }

  // Verify folder ownership
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { userId: true },
  });

  if (!folder || folder.userId !== userId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Folder not found or access denied',
    });
  }

  // Read file buffer
  const buffer = await fs.readFile(file.filepath);

  // Extract text based on file type
  let extractedText = '';
  let pageCount: number | undefined;

  switch (ext) {
    case '.pdf':
      const pdfResult = await extractPdfText(buffer);
      extractedText = pdfResult.text;
      pageCount = pdfResult.pageCount;
      break;
    case '.docx':
      const docxResult = await extractDocxText(buffer);
      extractedText = docxResult.text;
      break;
    case '.txt':
      const txtResult = extractTxtText(buffer);
      extractedText = txtResult.text;
      break;
  }

  // Validate extracted text
  if (!extractedText || extractedText.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Extracted text is too short. The file may be empty or unreadable.',
    });
  }

  // Limit text length (100k chars = ~28k tokens)
  const MAX_CHARS = 100000;
  if (extractedText.length > MAX_CHARS) {
    extractedText = extractedText.substring(0, MAX_CHARS);
  }

  // Estimate tokens
  const tokenEstimate = estimateTokensFromText(extractedText);
  const charCount = extractedText.length;

  // Save material with token metadata for analytics and avoiding recomputation
  const material = await prisma.material.create({
    data: {
      folderId,
      title: title || file.originalFilename || "Uploaded Document",
      content: extractedText,
      type: ext.substring(1), // Remove dot: .pdf -> pdf
      metadata: {
        tokenEstimate,
        charCount,
        pageCount: pageCount ?? null,
      },
    },
  });

  // Cleanup temp file
  try {
    await fs.unlink(file.filepath);
  } catch (error) {
    console.warn('Failed to cleanup temp file:', error);
  }

  return {
    materialId: material.id,
    tokenEstimate,
    charCount: extractedText.length,
    pageCount,
    title: material.title,
  };
});
