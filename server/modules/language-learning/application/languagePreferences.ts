import type { LanguagePreferencesDTO } from "@shared/utils/language.contract";

export function serializeLanguagePreferences(prefs: any) {
  return {
    id: prefs.id,
    userId: prefs.userId,
    enabled: prefs.enabled,
    targetLanguage: prefs.targetLanguage,
    nativeLanguage:
      prefs.nativeLanguage === "auto" ? "en" : prefs.nativeLanguage,
    translateOnCapture: prefs.translateOnCapture ?? true,
    autoEnroll: prefs.autoEnroll,
    sessionCardLimit: prefs.sessionCardLimit,
    showConsent: prefs.showConsent,
    createdAt: prefs.createdAt,
    updatedAt: prefs.updatedAt,
  };
}

export async function getOrCreateLanguagePreferences(input: {
  prisma: any;
  userId: string;
}) {
  let prefs = await input.prisma.userLanguagePreferences.findUnique({
    where: { userId: input.userId },
  });

  if (!prefs) {
    prefs = await input.prisma.userLanguagePreferences.create({
      data: { userId: input.userId },
    });
  }

  return serializeLanguagePreferences(prefs);
}

export async function updateLanguagePreferences(input: {
  prisma: any;
  userId: string;
  data: LanguagePreferencesDTO;
}) {
  const prefs = await input.prisma.userLanguagePreferences.upsert({
    where: { userId: input.userId },
    update: {
      ...input.data,
      updatedAt: new Date(),
    },
    create: {
      userId: input.userId,
      ...input.data,
    },
  });

  return serializeLanguagePreferences(prefs);
}
