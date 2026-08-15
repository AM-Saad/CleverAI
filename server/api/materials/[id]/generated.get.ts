// server/api/materials/[id]/generated.get.ts
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { MaterialGeneratedContentSchema } from "@@/shared/utils/material.contract";

const ParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Material ID must be a valid ObjectId"),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  // Parse and validate params
  const rawParams = getRouterParams(event);
  let params;
  try {
    params = ParamSchema.parse(rawParams);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw Errors.badRequest("Invalid material ID", err.issues);
    }
    throw Errors.badRequest("Invalid material ID");
  }

  // Fetch material with workspace to verify ownership
  const material = await prisma.material.findFirst({
    where: { id: params.id },
    include: {
      workspace: {
        select: { userId: true },
      },
    },
  });

  if (!material) {
    throw Errors.notFound("Material");
  }

  // Verify ownership
  if (material.workspace.userId !== user.id) {
    throw Errors.forbidden("You do not have access to this material.");
  }

  const [flashcards, questions] = await Promise.all([
    prisma.flashcard.findMany({
      where: { materialId: params.id, status: "ENROLLED" },
      select: {
        id: true,
        front: true,
        back: true,
        sourceRef: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.findMany({
      where: { materialId: params.id, status: "ENROLLED" },
      select: {
        id: true,
        question: true,
        choices: true,
        answerIndex: true,
        sourceRef: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const data = {
    flashcardsCount: flashcards.length,
    questionsCount: questions.length,
    flashcards,
    questions,
  };

  if (process.env.NODE_ENV === "development") {
    MaterialGeneratedContentSchema.parse(data);
  }

  return success(data);
});
