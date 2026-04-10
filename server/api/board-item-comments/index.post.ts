import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CreateBoardItemCommentDTO } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let data: CreateBoardItemCommentDTO;
  try {
    data = CreateBoardItemCommentDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest("Invalid request body", err.issues.map((i) => ({ path: i.path, message: i.message })));
    }
    throw Errors.badRequest("Invalid request body");
  }

  // Verify item exists and requestor has access
  const item = await prisma.boardItem.findFirst({
    where: { id: data.itemId, userId: user.id },
    select: { id: true },
  });

  if (!item) throw Errors.notFound("Board item");

  try {
    const comment = await prisma.boardItemComment.create({
      data: {
        itemId: data.itemId,
        userId: user.id,
        content: data.content,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    setResponseStatus(event, 201);
    return success({
      id: comment.id,
      itemId: comment.itemId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: { name: comment.user.name, email: comment.user.email ?? undefined },
    }, { message: "Comment added successfully" });
  } catch (error) {
    console.error("Failed to create board item comment:", error);
    throw Errors.server("Failed to create board item comment");
  }
});
