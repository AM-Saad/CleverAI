import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  CreateBoardColumnDTO,
  BoardColumnSchema,
} from "@@/shared/utils/boardColumn.contract";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";
import { positionBetween } from "@@/shared/utils/position-key";

export default defineEventHandler(async (event) => {
  try {
    const user = await requireRole(event, ["USER"]);
    const prisma = event.context.prisma;

    const body = await readBody(event);

    let data;
    try {
      data = CreateBoardColumnDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest(
          "Invalid request body",
          err.issues.map((i) => ({ path: i.path, message: i.message }))
        );
      }
      throw Errors.badRequest("Invalid request body");
    }

    // Get the max order for the user's columns
    const maxOrderResult = await prisma.boardColumn.aggregate({
      where: { userId: user.id },
      _max: { order: true },
    });
    const newOrder = (maxOrderResult._max.order ?? -1) + 1;
    const lastPositioned = await prisma.boardColumn.findFirst({ where: { userId: user.id, workspaceId: data.workspaceId ?? null }, orderBy: { position: "desc" }, select: { position: true } });

    const column = await prisma.boardColumn.create({
      data: {
        userId: user.id,
        name: data.name,
        order: newOrder,
        position: positionBetween(lastPositioned?.position, null),
        workspaceId: data.workspaceId,
      },
    });
    await advanceOfflineEntityState({ prisma, userId: user.id, entity: "boardColumn", entityId: column.id, changedFields: ["name", "workspaceId", "position"] });

    if (process.env.NODE_ENV === "development") {
      BoardColumnSchema.parse(column);
    }

    return success(column, { message: "Board column created successfully" });
  } catch (error: any) {
    console.error("💥 [API /board-columns] POST error:", error);
    if (error.statusCode) throw error;
    throw Errors.server(
      `Failed to create board column: ${error.message || "Unknown error"}`
    );
  }
});
