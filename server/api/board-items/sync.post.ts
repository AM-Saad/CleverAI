import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { BoardItemSchema } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);

  if (!Array.isArray(body)) {
    throw Errors.badRequest("Request body must be an array of board items");
  }

  try {
    // Validate all items
    body.forEach((item) => BoardItemSchema.parse(item));
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid board items in request",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid board items");
  }

  // Process each item
  const results = [];
  for (const item of body) {
    try {
      // Check if item exists
      const existing = await prisma.boardItem.findFirst({
        where: { id: item.id, userId: user.id },
      });

      if (existing) {
        // Update existing item
        const updated = await prisma.boardItem.update({
          where: { id: item.id },
          data: {
            content: item.content,
            tags: item.tags,
            order: item.order,
            updatedAt: new Date(item.updatedAt),
          },
        });
        results.push({ id: item.id, status: "updated", data: updated });
      } else {
        // Create new item (for offline-created temp items)
        const created = await prisma.boardItem.create({
          data: {
            id: item.id,
            userId: user.id,
            content: item.content,
            tags: item.tags || [],
            order: item.order || 0,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt),
          },
        });
        results.push({ id: item.id, status: "created", data: created });
      }
    } catch (error: any) {
      console.error(`Failed to sync board item ${item.id}:`, error);
      results.push({
        id: item.id,
        status: "error",
        error: error.message || "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.status !== "error").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return success(results, {
    message: `Synced ${successCount} board items, ${errorCount} errors`,
    successCount,
    errorCount,
  });
});
