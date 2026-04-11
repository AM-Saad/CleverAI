import { z, ZodError } from "zod";
import { requireRole } from "~~/server/utils/auth";
import { Errors, success } from "@server/utils/error";
import { LanguagePreferencesDTO } from "@shared/utils/language.contract";

export default defineEventHandler(async (event) => {
  const method = getMethod(event);
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  if (method === "GET") {
    let prefs = await prisma.userLanguagePreferences.findUnique({
      where: { userId: user.id },
    });

    if (!prefs) {
      prefs = await prisma.userLanguagePreferences.create({
        data: { userId: user.id },
      });
    }

    return success({
      id: prefs.id,
      userId: prefs.userId,
      enabled: prefs.enabled,
      targetLanguage: prefs.targetLanguage,
      nativeLanguage: prefs.nativeLanguage,
      autoEnroll: prefs.autoEnroll,
      sessionCardLimit: prefs.sessionCardLimit,
      showConsent: prefs.showConsent,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    });
  }

  if (method === "PUT") {
    const body = await readBody(event);
    let validatedPrefs;
    try {
      validatedPrefs = LanguagePreferencesDTO.parse(body);
    } catch (err) {
      if (err instanceof ZodError) {
        throw Errors.badRequest("Invalid preferences data", err.issues);
      }
      throw Errors.badRequest("Invalid preferences data");
    }

    const prefs = await prisma.userLanguagePreferences.upsert({
      where: { userId: user.id },
      update: {
        ...validatedPrefs,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        ...validatedPrefs,
      },
    });

    return success({
      id: prefs.id,
      userId: prefs.userId,
      enabled: prefs.enabled,
      targetLanguage: prefs.targetLanguage,
      nativeLanguage: prefs.nativeLanguage,
      autoEnroll: prefs.autoEnroll,
      sessionCardLimit: prefs.sessionCardLimit,
      showConsent: prefs.showConsent,
      createdAt: prefs.createdAt,
      updatedAt: prefs.updatedAt,
    });
  }

  throw Errors.methodNotAllowed();
});
