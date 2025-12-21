// server/api/materials/[id].get.ts
import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

const ParamSchema = z.object({
  id: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Material ID must be a valid MongoDB ObjectId"),
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

  // Fetch material with folder to verify ownership
  const material = await prisma.material.findFirst({
    where: { id: params.id },
    include: {
      folder: {
        select: { userId: true },
      },
    },
  });

  if (!material) {
    throw Errors.notFound("Material");
  }

  // Verify ownership
  if (material.folder.userId !== user.id) {
    throw Errors.forbidden("You do not have access to this material.");
  }

  // Remove folder from response (just needed for auth check)
  const { folder: _, ...materialData } = material;

  if (process.env.NODE_ENV === "development") {
    MaterialSchema.parse(materialData);
  }

  return success(materialData);
});
