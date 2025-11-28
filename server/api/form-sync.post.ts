// // server/api/form-sync.post.ts
// export default defineEventHandler(async (event) => {
//   const textDecoder = new TextDecoder();
//   const bad = (m: string) => {
//     setResponseStatus(event, 400);
//     return { ok: false, error: m };
//   };

import { requireRole } from "../middleware/auth";
import { Errors, success } from "@server/utils/error";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Form Sync API - Handles offline form synchronization
 *
 * Processes queued forms that were stored offline and syncs them when back online.
 * Supports different form types like material uploads, folder creation, etc.
 *
 * @body Array of form sync records or single record:
 * {
 *   id: string,
 *   type: FormSyncType,
 *   payload: Record<string, unknown>,
 *   createdAt: number
 * }
 */
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ["USER"]);
  const prisma = event.context.prisma;

  const body = await readBody(event);

  // Handle both single record and array of records
  const records = Array.isArray(body) ? body : [body];

  const results = [];
  const errors = [];

  for (const record of records) {
    const { id, type, payload, createdAt } = record;

    // Validate record structure
    if (!id || !type || !payload || typeof payload !== "object") {
      errors.push({
        id: id || "unknown",
        error: "Invalid record structure: missing id, type, or payload",
      });
      continue;
    }

    // Validate type
    if (!Object.values(FORM_SYNC_TYPES).includes(type as FormSyncType)) {
      errors.push({
        id,
        error: `Invalid form sync type: ${type}`,
      });
      continue;
    }

    try {
      const result = await handleFormSync({
        id,
        type: type as FormSyncType,
        payload,
        createdAt,
        user,
        prisma,
        event,
      });

      results.push({
        id,
        type,
        success: true,
        result,
      });

      console.log(`✅ Form sync successful: ${type} for user ${user.email}`, {
        id,
        payload,
      });
    } catch (error) {
      console.error(`❌ Form sync failed: ${type} for user ${user.email}`, {
        id,
        error,
      });
      errors.push({
        id,
        type,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return success({
    processed: records.length,
    successful: results.length,
    failed: errors.length,
    results,
    errors,
  });
});

/**
 * Route form sync to appropriate handler based on type
 */
async function handleFormSync(params: {
  id: string;
  type: FormSyncType;
  payload: Record<string, unknown>;
  createdAt: number;
  user: { id: string; email: string };
  prisma: any; // TODO: Replace with proper Prisma type
  event: any; // TODO: Replace with proper H3Event type
}) {
  const { type, payload, user, prisma } = params;

  switch (type) {
    // Material operations
    case FORM_SYNC_TYPES.UPLOAD_MATERIAL:
      return await handleMaterialUpload(payload, user, prisma);
    case FORM_SYNC_TYPES.UPDATE_MATERIAL:
      return await handleMaterialUpdate(payload, user, prisma);
    case FORM_SYNC_TYPES.DELETE_MATERIAL:
      return await handleMaterialDelete(payload, user, prisma);

    // Folder operations
    case FORM_SYNC_TYPES.CREATE_FOLDER:
      return await handleFolderCreate(payload, user, prisma);
    case FORM_SYNC_TYPES.UPDATE_FOLDER:
      return await handleFolderUpdate(payload, user, prisma);
    case FORM_SYNC_TYPES.DELETE_FOLDER:
      return await handleFolderDelete(payload, user, prisma);

    // Note operations
    case FORM_SYNC_TYPES.CREATE_NOTE:
      return await handleNoteCreate(payload, user, prisma);
    case FORM_SYNC_TYPES.UPDATE_NOTE:
      return await handleNoteUpdate(payload, user, prisma);
    case FORM_SYNC_TYPES.DELETE_NOTE:
      return await handleNoteDelete(payload, user, prisma);

    // Review operations
    case FORM_SYNC_TYPES.ENROLL_CARD:
      return await handleCardEnroll(payload, user, prisma);
    case FORM_SYNC_TYPES.GRADE_CARD:
      return await handleCardGrade(payload, user, prisma);
    case FORM_SYNC_TYPES.UNENROLL_CARD:
      return await handleCardUnenroll(payload, user, prisma);

    // User preference operations
    case FORM_SYNC_TYPES.UPDATE_PREFERENCES:
      return await handlePreferencesUpdate(payload, user, prisma);
    case FORM_SYNC_TYPES.UPDATE_NOTIFICATION_SETTINGS:
      return await handleNotificationSettingsUpdate(payload, user, prisma);

    default:
      throw new Error(`Unhandled form sync type: ${type}`);
  }
}

// ===== MATERIAL HANDLERS =====
async function handleMaterialUpload(
  payload: Record<string, unknown>,
  user: { id: string; email: string },
  prisma: any
) {
  const { materialTitle, materialContent, materialType, folderId } = payload;

  if (!materialTitle || !materialContent || !folderId) {
    throw new Error(
      "Missing required fields: materialTitle, materialContent, or folderId"
    );
  }

  // Verify folder belongs to user
  const folder = await prisma.folder.findFirst({
    where: { id: folderId as string, userId: user.id },
  });

  if (!folder) {
    throw new Error("Folder not found or access denied");
  }

  return await prisma.material.create({
    data: {
      title: materialTitle as string,
      content: materialContent as string,
      type: (materialType as string) || "text",
      folderId: folderId as string,
      userId: user.id,
    },
  });
}

async function handleMaterialUpdate(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { materialId, ...updateData } = payload;

  if (!materialId) {
    throw new Error("Missing materialId");
  }

  return await prisma.material.updateMany({
    where: { id: materialId as string, userId: user.id },
    data: updateData,
  });
}

async function handleMaterialDelete(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { materialId } = payload;

  if (!materialId) {
    throw new Error("Missing materialId");
  }

  return await prisma.material.deleteMany({
    where: { id: materialId as string, userId: user.id },
  });
}

// ===== FOLDER HANDLERS =====
async function handleFolderCreate(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { name, description } = payload;

  if (!name) {
    throw new Error("Missing required field: name");
  }

  return await prisma.folder.create({
    data: {
      name: name as string,
      description: (description as string) || null,
      userId: user.id,
    },
  });
}

async function handleFolderUpdate(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { folderId, ...updateData } = payload;

  if (!folderId) {
    throw new Error("Missing folderId");
  }

  return await prisma.folder.updateMany({
    where: { id: folderId as string, userId: user.id },
    data: updateData,
  });
}

async function handleFolderDelete(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { folderId } = payload;

  if (!folderId) {
    throw new Error("Missing folderId");
  }

  return await prisma.folder.deleteMany({
    where: { id: folderId as string, userId: user.id },
  });
}

// ===== NOTE HANDLERS =====
async function handleNoteCreate(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { content, folderId } = payload;

  if (!content || !folderId) {
    throw new Error("Missing required fields: content or folderId");
  }

  return await prisma.note.create({
    data: {
      content: content as string,
      folderId: folderId as string,
      userId: user.id,
    },
  });
}

async function handleNoteUpdate(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { noteId, ...updateData } = payload;

  if (!noteId) {
    throw new Error("Missing noteId");
  }

  return await prisma.note.updateMany({
    where: { id: noteId as string, userId: user.id },
    data: updateData,
  });
}

async function handleNoteDelete(
  payload: Record<string, unknown>,
  user: any,
  prisma: any
) {
  const { noteId } = payload;

  if (!noteId) {
    throw new Error("Missing noteId");
  }

  return await prisma.note.deleteMany({
    where: { id: noteId as string, userId: user.id },
  });
}

// ===== REVIEW HANDLERS =====
async function handleCardEnroll(
  _payload: Record<string, unknown>,
  _user: any,
  _prisma: any
) {
  // Implementation for card enrollment
  // This would integrate with your existing review system
  throw new Error("Card enrollment sync not yet implemented");
}

async function handleCardGrade(
  _payload: Record<string, unknown>,
  _user: any,
  _prisma: any
) {
  // Implementation for card grading
  throw new Error("Card grading sync not yet implemented");
}

async function handleCardUnenroll(
  _payload: Record<string, unknown>,
  _user: any,
  _prisma: any
) {
  // Implementation for card unenrollment
  throw new Error("Card unenrollment sync not yet implemented");
}

// ===== USER PREFERENCE HANDLERS =====
async function handlePreferencesUpdate(
  _payload: Record<string, unknown>,
  _user: any,
  _prisma: any
) {
  // Implementation for user preferences update
  throw new Error("Preferences update sync not yet implemented");
}

async function handleNotificationSettingsUpdate(
  _payload: Record<string, unknown>,
  _user: any,
  _prisma: any
) {
  // Implementation for notification settings update
  throw new Error("Notification settings sync not yet implemented");
}
