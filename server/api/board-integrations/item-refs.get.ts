import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import {
  BoardItemExternalRefSchema,
} from "../../../shared/utils/boardIntegration.contract";
import { serializeBoardItemExternalRef } from "@server/modules/integrations/application/boardIntegrationSerialization";
import { integrationRepository } from "@server/modules/integrations/infrastructure/integrationRepository";

const QuerySchema = z.object({
  itemId: z.string(),
});

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma as any;

  let query: z.infer<typeof QuerySchema>;
  try {
    query = QuerySchema.parse(getQuery(event));
  } catch (error) {
    if (error instanceof ZodError) {
      throw Errors.badRequest("Invalid item refs query");
    }
    throw error;
  }

  const item = await prisma.boardItem.findFirst({
    where: { id: query.itemId, userId: user.id },
    select: { id: true },
  });
  if (!item) throw Errors.notFound("Board item");

  const refs = await integrationRepository.listItemRefs(prisma, {
    itemId: query.itemId,
    userId: user.id,
  });

  return success(refs.map((ref: any) =>
    BoardItemExternalRefSchema.parse(serializeBoardItemExternalRef(ref)),
  ));
});
