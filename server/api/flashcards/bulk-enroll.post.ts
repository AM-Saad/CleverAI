import { requireRole } from "~~/server/utils/auth";
import { z } from "zod";

const BulkEnrollSchema = z.object({
  itemIds: z.array(z.string()).min(1),
});

/**
 * Bulk enroll flashcards - update status to ENROLLED
 */
export default defineEventHandler(async (event) => {
  // Auth check
  const user = await requireRole(event, ["USER"]);
  const userId = user.id;

  // Validate input
  const body = await readBody(event);
  const { itemIds } = BulkEnrollSchema.parse(body);

  try {
    // Update all items to ENROLLED status
    // Verify ownership by checking folderId -> userId
    const result = await prisma.flashcard.updateMany({
      where: {
        id: { in: itemIds },
        folder: {
          userId: userId,
        },
      },
      data: {
        status: "ENROLLED",
      },
    });

    return {
      success: true,
      enrolledCount: result.count,
    };
  } catch (error) {
    console.error("Bulk enroll flashcards error:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to enroll flashcards",
    });
  }
});
