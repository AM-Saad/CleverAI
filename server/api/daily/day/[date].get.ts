import { ZodError } from "zod";
import {
  DateKeySchema,
  DayProjectionSchema,
} from "@shared/utils/daily.contract";
import { projectDailyDay } from "@server/modules/daily/application/projectDailyDay";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  let dateKey: string;
  try {
    dateKey = DateKeySchema.parse(getRouterParam(event, "date"));
  } catch (error) {
    if (error instanceof ZodError)
      throw Errors.badRequest("Invalid calendar date", error.issues);
    throw Errors.badRequest("Invalid calendar date");
  }
  const projection = await projectDailyDay({
    prisma: event.context.prisma,
    userId: user.id,
    dateKey,
  });
  return success(DayProjectionSchema.parse(projection));
});
