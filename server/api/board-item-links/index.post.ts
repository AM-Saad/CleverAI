import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { CreateBoardItemLinkDTO } from "~/shared/utils/boardItem.contract";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  let data: CreateBoardItemLinkDTO;
  try {
    data = CreateBoardItemLinkDTO.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw Errors.badRequest("Invalid request body", err.issues.map((i) => ({ path: i.path, message: i.message })));
    }
    throw Errors.badRequest("Invalid request body");
  }

  if (data.sourceId === data.targetId) {
    throw Errors.badRequest("Cannot link an item to itself");
  }

  // Verify both items belong to the user
  const [source, target] = await Promise.all([
    prisma.boardItem.findFirst({ where: { id: data.sourceId, userId: user.id }, select: { id: true } }),
    prisma.boardItem.findFirst({ where: { id: data.targetId, userId: user.id }, select: { id: true } }),
  ]);

  if (!source) throw Errors.notFound("Source board item");
  if (!target) throw Errors.notFound("Target board item");

  try {
    const link = await prisma.boardItemLink.create({
      data: {
        sourceId: data.sourceId,
        targetId: data.targetId,
        linkType: data.linkType,
        userId: user.id,
      },
      include: {
        target: { select: { id: true, content: true, columnId: true, tags: true, dueDate: true } },
        source: { select: { id: true, content: true, columnId: true, tags: true, dueDate: true } },
      },
    });

    setResponseStatus(event, 201);
    return success(link, { message: "Link created successfully" });
  } catch (error: any) {
    // Unique constraint: link already exists
    if (/unique|duplicate/i.test(String(error?.message || ""))) {
      throw Errors.badRequest("A link between these two items already exists");
    }
    console.error("Failed to create board item link:", error);
    throw Errors.server("Failed to create board item link");
  }
});
