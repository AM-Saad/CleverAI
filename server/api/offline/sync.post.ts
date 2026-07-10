import { ZodError } from "zod";
import { OfflineSyncRequestSchema } from "@@/shared/utils/offline-sync.contract";
import { syncOfflineMutations } from "@server/modules/offline/application/syncOfflineMutations";
import { Errors, success } from "@server/utils/error";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig(event).public.offlineV2 === false) {
    throw Errors.notFound("Offline synchronization is not enabled");
  }
  const user = await requireRole(event, ["USER"]);
  let body: ReturnType<typeof OfflineSyncRequestSchema.parse>;
  try {
    body = OfflineSyncRequestSchema.parse(await readBody(event));
  } catch (error) {
    if (error instanceof ZodError) throw Errors.badRequest("Invalid offline sync request", error.issues);
    throw Errors.badRequest("Invalid offline sync request");
  }
  return success(await syncOfflineMutations({ prisma: event.context.prisma, userId: user.id, mutations: body.mutations }));
});
