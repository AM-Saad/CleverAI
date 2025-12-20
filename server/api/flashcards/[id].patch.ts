// server/api/flashcards/[id].patch.ts
/**
 * Update a flashcard
 * PATCH /api/flashcards/:id
 * Body: { front?: string, back?: string }
 */

import { UpdateFlashcardDTO } from "@@/shared/utils/flashcard.contract";
import { requireRole } from "~~/server/middleware/_auth";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const id = getRouterParam(event, "id");
  if (!id) {
    throw Errors.badRequest("Flashcard ID is required");
  }

  const body = await readBody(event);
  const parsed = UpdateFlashcardDTO.safeParse(body);

  if (!parsed.success) {
    throw Errors.badRequest("Invalid request data", parsed.error.issues);
  }

  const { front, back } = parsed.data;

  // Check if there's anything to update
  if (!front && !back) {
    throw Errors.badRequest(
      "At least one field (front or back) must be provided"
    );
  }

  // Verify flashcard exists and belongs to user's folder
  const existingFlashcard = await prisma.flashcard.findFirst({
    where: { id },
    include: { folder: { select: { userId: true } } },
  });

  if (!existingFlashcard) {
    throw Errors.notFound("Flashcard");
  }

  if (existingFlashcard.folder.userId !== user.id) {
    throw Errors.forbidden(
      "You don't have permission to update this flashcard"
    );
  }

  // Update the flashcard
  const updatedFlashcard = await prisma.flashcard.update({
    where: { id },
    data: {
      ...(front && { front }),
      ...(back && { back }),
    },
  });

  return success(updatedFlashcard);
});
