import { Errors } from "../../../utils/error";
import {
  injectNoteBlockMarkers,
  injectPdfPageMarkers,
} from "../../../utils/contextBridge";
import type { GatewayGenerateRequest } from "../../../../shared/utils/llm-generate.contract";

const MAX_GATEWAY_CHARS = 100_000;

type LoadedMaterialRecord = {
  id: string;
  content?: string | null;
  type?: string | null;
  metadata?: unknown;
  workspace: {
    userId: string;
    id: string;
  };
};

export interface PrepareGatewayGenerationInput {
  prisma: any;
  userId: string;
  request: GatewayGenerateRequest;
}

export interface PrepareGatewayGenerationResult {
  text: string;
  canSave: boolean;
  saveWorkspaceId?: string;
  loadedMaterialType?: string | null;
  materialId?: string;
}

function injectMaterialContext(material: LoadedMaterialRecord, text: string) {
  if (material.type === "pdf" && material.metadata) {
    const pageCount = (material.metadata as { pageCount?: unknown })?.pageCount;
    return injectPdfPageMarkers(
      text,
      typeof pageCount === "number" ? pageCount : undefined,
    );
  }

  if (material.type === "txt" || !material.type) {
    return injectNoteBlockMarkers(text);
  }

  return text;
}

async function loadOwnedMaterial(
  prisma: any,
  materialId: string,
  userId: string,
): Promise<LoadedMaterialRecord> {
  const material = (await prisma.material.findUnique({
    where: { id: materialId },
    include: { workspace: { select: { userId: true, id: true } } },
  })) as LoadedMaterialRecord | null;

  if (!material) {
    throw Errors.notFound("Material not found.");
  }

  if (material.workspace.userId !== userId) {
    throw Errors.forbidden("You do not have access to this material.");
  }

  return material;
}

export async function prepareGatewayGeneration(
  input: PrepareGatewayGenerationInput,
): Promise<PrepareGatewayGenerationResult> {
  const { prisma, userId, request } = input;
  const { materialId, save, workspaceId, text: originalText } = request;

  const loadedMaterial = materialId
    ? await loadOwnedMaterial(prisma, materialId, userId)
    : null;

  let text = originalText?.trim() ?? "";
  if (loadedMaterial) {
    text = injectMaterialContext(loadedMaterial, loadedMaterial.content ?? "");
  }

  if (text.length === 0) {
    throw Errors.badRequest("Text is required");
  }

  if (text.length > MAX_GATEWAY_CHARS) {
    throw Errors.badRequest("Text too large");
  }

  if (!save) {
    return {
      text,
      canSave: false,
      loadedMaterialType: loadedMaterial?.type ?? null,
      materialId,
    };
  }

  if (loadedMaterial) {
    return {
      text,
      canSave: true,
      saveWorkspaceId: loadedMaterial.workspace.id,
      loadedMaterialType: loadedMaterial.type ?? null,
      materialId,
    };
  }

  if (!workspaceId) {
    return {
      text,
      canSave: false,
      loadedMaterialType: null,
      materialId,
    };
  }

  const ownerWorkspace = await prisma.workspace.findFirst({
    where: { id: workspaceId, userId },
  });

  if (!ownerWorkspace) {
    throw Errors.forbidden("You do not have access to this workspace.");
  }

  return {
    text,
    canSave: true,
    saveWorkspaceId: workspaceId,
    loadedMaterialType: null,
    materialId,
  };
}
