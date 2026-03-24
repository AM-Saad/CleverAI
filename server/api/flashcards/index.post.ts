// server/api/flashcards/index.post.ts
/**
 * Create a manual flashcard
 * POST /api/flashcards
 * Body: { workspaceId: string, front: string, back: string }
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

  const { workspaceId, front, back, materialId } = parsed.data;

  // Verify workspace belongs to user
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId: user.id },
  });

  if (!workspace) {
    throw Errors.notFound("Workspace");
  }

  // If materialId provided, verify it belongs to the workspace
  if (materialId) {
    const material = await prisma.material.findFirst({
      where: { id: materialId, workspaceId },
    });

    if (!material) {
      throw Errors.badRequest("Material not found in this workspace");
    }
  }

  // Create the flashcard
  const flashcard = await prisma.flashcard.create({
    data: {
      front,
      back,
      workspaceId,
      materialId: materialId || null,
    },
  });

  return success(flashcard);
});
