import { z } from "zod";
import {
  WorkspaceSummarySchema,
  WorkspaceStudyContentSchema,
  type WorkspaceSummary,
  type WorkspaceStudyContent,
  type CreateWorkspaceDTO,
  type UpdateWorkspaceDTO,
} from "@@/shared/utils/workspace.contract";
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

  const { data, pending, error, refresh } = useDataFetch<WorkspaceSummary[]>(
    "workspaces",
    () => $api.workspaces.getWorkspaces(WorkspacesResponseSchema)
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

  const createWorkspace = async (payload: CreateWorkspaceDTO) => {
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
  const { data, pending, error, refresh } = useDataFetch<WorkspaceSummary>(
    `workspace-${id}`,
    () => $api.workspaces.getWorkspace(id, WorkspaceResponseSchema)
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
  const { data, pending, error, refresh } = useDataFetch<WorkspaceStudyContent>(
    `workspace-${id}-study-content`,
    () =>
      $api.workspaces.getStudyContent(
        id,
        WorkspaceStudyContentResponseSchema,
      )
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

  const deleteWorkspace = async (id: string) => {
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

  const updateWorkspace = async (
    payload: UpdateWorkspaceDTO
  ) => {
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
