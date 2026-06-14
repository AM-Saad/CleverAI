import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;
  const id = getRouterParam(event, "id");
  if (!id) throw Errors.badRequest("Missing integration account id");

  const account = await integrationRepository.findAccount(prisma, {
    id,
    userId: user.id,
  });
  if (!account) throw Errors.notFound("Integration account");

  await integrationRepository.deleteAccountGraph(prisma, { id, userId: user.id });
  return success({ id }, { message: "Integration disconnected" });
});
