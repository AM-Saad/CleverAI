import { ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguagePreferencesDTO } from "@shared/utils/language.contract";
import {
  getOrCreateLanguagePreferences,
  updateLanguagePreferences,
} from "@server/modules/language-learning/application/languagePreferences";
import { advanceOfflineEntityState } from "@server/modules/offline/application/advanceOfflineEntityState";

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  if (method === "GET") {
    return success(
      await getOrCreateLanguagePreferences({ prisma, userId: user.id }),
    );
  }

  if (method === "PUT") {
    let validatedPrefs;
    try {
      validatedPrefs = LanguagePreferencesDTO.parse(await readBody(event));
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest("Invalid preferences data", err.issues);
      }
      throw Errors.badRequest("Invalid preferences data");
    }

    const updated = await updateLanguagePreferences({
      prisma,
      userId: user.id,
      data: validatedPrefs,
    });
    const offlineVersion = await advanceOfflineEntityState({
      prisma,
      userId: user.id,
      entity: "languagePreference",
      entityId: updated.id,
      changedFields: Object.keys(validatedPrefs),
    });
    return success({ ...updated, offlineVersion });
  }

  throw Errors.methodNotAllowed();
});
