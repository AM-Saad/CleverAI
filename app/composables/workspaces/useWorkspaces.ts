import { z } from "zod";
import type { Workspace, CreateWorkspaceDTO, UpdateWorkspaceDTO } from "@@/shared/utils/workspace.contract";
const WorkspaceResponse = z
  .union([WorkspaceSchema, z.object({ data: WorkspaceSchema })])
  .transform((x) => ("id" in x ? x : x.data));
const WorkspacesResponse = z
  .union([z.array(WorkspaceSchema), z.object({ data: z.array(WorkspaceSchema) })])
  .transform((x) => (Array.isArray(x) ? x : x.data));

// Simplified schema assignments without problematic ZodOut type
const WorkspacesResponseSchema = WorkspacesResponse;
const WorkspaceResponseSchema = WorkspaceResponse;

export function useWorkspaces() {
  const { $api } = useNuxtApp();

  const { data, pending, error, refresh } = useDataFetch<Workspace[]>(
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

export function useCreateWorkspace(refreshWorkspaces?: () => void) {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const createOperation = useOperation<Workspace>();

  const createWorkspace = async (payload: CreateWorkspaceDTO) => {
    const result = await createOperation.execute(async () => {
      return await $api.workspaces.create(payload);
    });
    console.log("createWorkspace", result);
    if (refreshWorkspaces) refreshWorkspaces();
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
  const { data, pending, error, refresh } = useDataFetch<Workspace>(
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
  const updateOperation = useOperation<Workspace>();

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
