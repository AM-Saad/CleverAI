// server/api/flashcards/index.post.ts
/**
 * Create a manual flashcard
 * POST /api/flashcards
 * Body: { folderId: string, front: string, back: string }
 */

import { CreateFlashcardDTO } from "@@/shared/utils/flashcard.contract";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const parsed = CreateFlashcardDTO.safeParse(body);

  if (!parsed.success) {
    throw Errors.badRequest("Invalid request data", parsed.error.issues);
  }

  const { folderId, front, back, materialId } = parsed.data;

  // Verify folder belongs to user
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, userId: user.id },
  });

  if (!folder) {
    throw Errors.notFound("Folder");
  }

  // If materialId provided, verify it belongs to the folder
  if (materialId) {
    const material = await prisma.material.findFirst({
      where: { id: materialId, folderId },
    });

    if (!material) {
      throw Errors.badRequest("Material not found in this folder");
    }
  }

  // Create the flashcard
  const flashcard = await prisma.flashcard.create({
    data: {
      front,
      back,
      folderId,
      materialId: materialId || null,
    },
  });

  return success(flashcard);
});
