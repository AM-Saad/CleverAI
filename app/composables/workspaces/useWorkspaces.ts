import { z } from "zod";
import {
  WorkspaceSummarySchema,
  WorkspaceStudyContentSchema,
  type WorkspaceSummary,
  type WorkspaceStudyContent,
  type CreateWorkspaceDTO,
  type UpdateWorkspaceDTO,
} from "@@/shared/utils/workspace.contract";
import { listOfflineEntities, putOfflineEntities } from "~/utils/offline-v2/repository";
import { useOfflineRuntime } from "~/composables/offline/useOfflineRuntime";
const WorkspaceResponse = z
  .union([WorkspaceSummarySchema, z.object({ data: WorkspaceSummarySchema })])
  .transform((x) => ("id" in x ? x : x.data));
const WorkspacesResponse = z
  .union([
    z.array(WorkspaceSummarySchema),
    z.object({ data: z.array(WorkspaceSummarySchema) }),
  ])
  .transform((x) => (Array.isArray(x) ? x : x.data));
const WorkspaceStudyContentResponse = z
  .union([
    WorkspaceStudyContentSchema,
    z.object({ data: WorkspaceStudyContentSchema }),
  ])
  .transform((x) => ("flashcards" in x ? x : x.data));

// Simplified schema assignments without problematic ZodOut type
const WorkspacesResponseSchema = WorkspacesResponse;
const WorkspaceResponseSchema = WorkspaceResponse;
const WorkspaceStudyContentResponseSchema = WorkspaceStudyContentResponse;

export function useWorkspaces() {
  const { $api } = useNuxtApp();
  const offline = useOfflineRuntime();

  const { data, pending, error, refresh } = useDataFetch<WorkspaceSummary[]>(
    "workspaces",
    async () => {
      if (!offline.isOnline.value && offline.accountId.value) {
        const local = await listOfflineEntities<WorkspaceSummary>(offline.accountId.value, "workspace");
        return { success: true, data: local.map((record) => record.data) } as any;
      }
      const result = await $api.workspaces.getWorkspaces(WorkspacesResponseSchema);
      if (result.success && offline.accountId.value) {
        await putOfflineEntities(result.data.map((workspace) => ({
          id: `${offline.accountId.value}:workspace:${workspace.id}`,
          accountId: offline.accountId.value,
          entity: "workspace" as const,
          entityId: workspace.id,
          version: 0,
          updatedAt: Date.now(),
          data: workspace as unknown as Record<string, unknown>,
        })));
      }
      return result;
    }
  );
  return {
    workspaces: data,
    loading: pending,
    error,
    refresh,
  };
}

export function useCreateWorkspace(refreshWorkspaces?: () => void | Promise<void>) {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const createOperation = useOperation<WorkspaceSummary>();
  const offline = useOfflineRuntime();

  const createWorkspace = async (payload: CreateWorkspaceDTO) => {
    if (!offline.isOnline.value) {
      const { entityId } = await offline.queue({
        entity: "workspace",
        operation: "workspace.create",
        changedFields: ["title", "description", "metadata"],
        payload: payload as Record<string, unknown>,
        localData: {
          title: payload.title,
          description: payload.description ?? null,
          metadata: payload.metadata ?? null,
          order: Date.now(),
          llmModel: "gpt-3.5",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      const local = { id: entityId, title: payload.title, description: payload.description ?? null, metadata: payload.metadata ?? null, order: Date.now(), llmModel: "gpt-3.5", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as WorkspaceSummary;
      if (refreshWorkspaces) await refreshWorkspaces();
      return local;
    }
    const result = await createOperation.execute(async () => {
      return await $api.workspaces.create(payload);
    });
    console.log("createWorkspace", result);
    if (refreshWorkspaces) await refreshWorkspaces();
    return result;
  };

  return {
    createWorkspace,
    creating: createOperation.pending,
    error: createOperation.error,
    typedError: createOperation.typedError,
    reset: createOperation.reset,
  };
}

export const useWorkspace = (id: string) => {
  const { $api } = useNuxtApp();
  const offline = useOfflineRuntime();
  const { data, pending, error, refresh } = useDataFetch<WorkspaceSummary>(
    `workspace-${id}`,
    async () => {
      if (!offline.isOnline.value && offline.accountId.value) {
        const local = await listOfflineEntities<WorkspaceSummary>(offline.accountId.value, "workspace");
        const workspace = local.find((record) => record.entityId === id)?.data;
        return workspace ? { success: true, data: workspace } as any : { success: false, error: { message: "This workspace has not been downloaded for offline use." } } as any;
      }
      return $api.workspaces.getWorkspace(id, WorkspaceResponseSchema);
    }
  );

  return {
    workspace: data,
    loading: pending,
    error,
    refresh,
  };
};

export const useWorkspaceStudyContent = (id: string) => {
  const { $api } = useNuxtApp();
  const offline = useOfflineRuntime();
  const { data, pending, error, refresh } = useDataFetch<WorkspaceStudyContent>(
    `workspace-${id}-study-content`,
    async () => {
      if (!offline.isOnline.value && offline.accountId.value) {
        const stored = await listOfflineEntities<Record<string, unknown>>(offline.accountId.value, "studyContent", id);
        return { success: true, data: { flashcards: stored.filter((record) => "front" in record.data).map((record) => record.data), questions: stored.filter((record) => "question" in record.data).map((record) => record.data) } } as any;
      }
      return $api.workspaces.getStudyContent(id, WorkspaceStudyContentResponseSchema);
    }
  );

  return {
    studyContent: data,
    loading: pending,
    error,
    refresh,
  };
};

export function useDeleteWorkspace(refreshWorkspaces: () => void) {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const deleteOperation = useOperation();
  const offline = useOfflineRuntime();

  const deleteWorkspace = async (id: string) => {
    if (!offline.isOnline.value) {
      await offline.queue({ entity: "workspace", operation: "workspace.delete", entityId: id, changedFields: ["deleted"], payload: {} });
      refreshWorkspaces();
      return { deleted: true } as any;
    }
    const result = await deleteOperation.execute(async () => {
      return await $api.workspaces.delete(id);
    });
    console.log("deleteWorkspace", result);
    refreshWorkspaces();
    return result;
  };

  return {
    deleteWorkspace,
    deleting: deleteOperation.pending,
    error: deleteOperation.error,
    typedError: deleteOperation.typedError,
    result: deleteOperation.data,
  };
}

export function useUpdateWorkspace() {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const updateOperation = useOperation<WorkspaceSummary>();
  const offline = useOfflineRuntime();

  const updateWorkspace = async (
    payload: UpdateWorkspaceDTO
  ) => {
    if (!offline.isOnline.value) {
      const data = { ...payload } as Record<string, unknown>;
      delete data.id;
      await offline.queue({ entity: "workspace", operation: "workspace.update", entityId: payload.id, changedFields: Object.keys(data), payload: data });
      return { id: payload.id, ...data } as WorkspaceSummary;
    }
    return await updateOperation.execute(async () => {
      return await $api.workspaces.update(payload.id, payload);
    });
  };

  return {
    updateWorkspace,
    updating: updateOperation.pending,
    error: updateOperation.error,
    typedError: updateOperation.typedError,
    reset: updateOperation.reset,
  };
}
