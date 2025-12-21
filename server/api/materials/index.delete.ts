import { z } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);
  const schema = z.object({ id: z.string() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw Errors.badRequest("Invalid request body", parsed.error.issues);
  }
  const { id } = parsed.data;

  const material = await prisma.material.findFirst({
    where: { id, folder: { userId: user.id } },
  });
  if (!material) {
    throw Errors.notFound("Material");
  }

  await prisma.material.delete({ where: { id } });
  return success({ message: "Material deleted successfully" });
});
