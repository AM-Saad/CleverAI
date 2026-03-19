import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  UpdateBoardColumnDTO,
  BoardColumnSchema,
} from "@@/shared/utils/boardColumn.contract";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;
    const columnId = getRouterParam(event, "id");

    if (!columnId) {
      throw Errors.badRequest("Column ID is required");
    }

    // Verify column belongs to user
    const existingColumn = await prisma.boardColumn.findFirst({
      where: { id: columnId, userId: user.id },
    });

    if (!existingColumn) {
      throw Errors.notFound("Board column not found");
    }

    const body = await readBody(event);

    let data;
    try {
      data = UpdateBoardColumnDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    const column = await prisma.boardColumn.update({
      where: { id: columnId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
      },
    });

    if (process.env.NODE_ENV === "development") {
      BoardColumnSchema.parse(column);
    }

    return success(column, { message: "Board column updated successfully" });
  } catch (error: any) {
    console.error("💥 [API /board-columns/:id] PATCH error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to update board column: ${error.message || "Unknown error"}`
    );
  }
});
