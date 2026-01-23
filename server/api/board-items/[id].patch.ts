import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { UpdateBoardItemDTO, BoardItemSchema } from "~/shared/utils/boardItem.contract";

// Simple retry helper for transient Prisma write conflicts / deadlocks
async function retryPrismaUpdate<T>(
  fn: () => Promise<T>,
  attempts = 4
): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isConflict = /write conflict|deadlock/i.test(msg);
      if (!isConflict) throw err;
      lastErr = err;
      const sleep = 50 * Math.pow(2, i) + Math.floor(Math.random() * 25);
      await new Promise((r) => setTimeout(r, sleep));
    }
  }
  throw lastErr;
}

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);

  let data;
  try {
    data = UpdateBoardItemDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest(
        "Invalid request body",
        err.issues.map((i) => ({ path: i.path, message: i.message }))
      );
    }
    throw Errors.badRequest("Invalid request body");
  }

  const { id } = body;
  if (!id || typeof id !== "string") {
    throw Errors.badRequest("Board item ID is required");
  }

  try {
    const item = await prisma.boardItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!item) {
      throw Errors.notFound("Board item");
    }

    const updatedItem = await retryPrismaUpdate(() =>
      prisma.boardItem.update({
        where: { id },
        data: {
          content: data.content,
          tags: data.tags,
        },
      })
    );

    if (process.env.NODE_ENV === "development") {
      BoardItemSchema.parse(updatedItem);
    }

    return success(updatedItem, {
      message: "Board item updated successfully",
      itemId: updatedItem.id,
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (/write conflict|deadlock/i.test(msg)) {
      console.error("Prisma write conflict after retries for board item", id, error);
      throw Errors.server("Board item update temporarily conflicted. Please retry.");
    }
    console.error("Error updating board item:", error);
    throw Errors.server("An error occurred while updating the board item.");
  }
});
