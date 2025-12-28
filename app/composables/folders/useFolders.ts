import { z } from "zod";
import type { Folder, CreateFolderDTO, UpdateFolderDTO } from "@@/shared/utils/folder.contract";
const FolderResponse = z
  .union([FolderSchema, z.object({ data: FolderSchema })])
  .transform((x) => ("id" in x ? x : x.data));
const FoldersResponse = z
  .union([z.array(FolderSchema), z.object({ data: z.array(FolderSchema) })])
  .transform((x) => (Array.isArray(x) ? x : x.data));

// Simplified schema assignments without problematic ZodOut type
const FoldersResponseSchema = FoldersResponse;
const FolderResponseSchema = FolderResponse;

export function useFolders() {
  const { $api } = useNuxtApp();

  const { data, pending, error, refresh } = useDataFetch<Folder[]>(
    "folders",
    () => $api.folders.getFolders(FoldersResponseSchema)
  );
  return {
    folders: data,
    loading: pending,
    error,
    refresh,
  };
}

export function useCreateFolder(refreshFolders?: () => void) {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const createOperation = useOperation<Folder>();

  const createFolder = async (payload: CreateFolderDTO) => {
    const result = await createOperation.execute(async () => {
      return await $api.folders.create(payload);
    });
    console.log("createFolder", result);
    if (refreshFolders) refreshFolders();
    return result;
  };

  return {
    createFolder,
    creating: createOperation.pending,
    error: createOperation.error,
    typedError: createOperation.typedError,
    reset: createOperation.reset,
  };
}

export const useFolder = (id: string) => {
  const { $api } = useNuxtApp();
  const { data, pending, error, refresh } = useDataFetch<Folder>(
    `folder-${id}`,
    () => $api.folders.getFolder(id, FolderResponseSchema)
  );

  return {
    folder: data,
    loading: pending,
    error,
    refresh,
  };
};

export function useDeleteFolder(refreshFolders: () => void) {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const deleteOperation = useOperation();

  const deleteFolder = async (id: string) => {
    const result = await deleteOperation.execute(async () => {
      return await $api.folders.delete(id);
    });
    console.log("deleteFolder", result);
    refreshFolders();
    return result;
  };

  return {
    deleteFolder,
    deleting: deleteOperation.pending,
    error: deleteOperation.error,
    typedError: deleteOperation.typedError,
    result: deleteOperation.data,
  };
}

export function useUpdateFolder() {
  const { $api } = useNuxtApp();
  // Use centralized operation handling - all errors constructed by FetchFactory
  const updateOperation = useOperation<Folder>();

  const updateFolder = async (
    payload: UpdateFolderDTO
  ) => {
    return await updateOperation.execute(async () => {
      return await $api.folders.update(payload.id, payload);
    });
  };

  return {
    updateFolder,
    updating: updateOperation.pending,
    error: updateOperation.error,
    typedError: updateOperation.typedError,
    reset: updateOperation.reset,
  };
}
