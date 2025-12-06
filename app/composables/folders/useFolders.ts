import { z } from "zod";

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

export function useCreateFolder() {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const createOperation = useOperation<Folder>();

  const createFolder = async (payload: typeof CreateFolderDTO) => {
    return await createOperation.execute(async () => {
      return await $api.folders.create(payload);
    });
  };

  return {
    createFolder,
    creating: createOperation.pending,
    error: createOperation.error,
    typedError: createOperation.typedError,
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

export function useDeleteFolder(id: string) {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const deleteOperation = useOperation<{ success: boolean }>();

  const deleteFolder = async () => {
    return await deleteOperation.execute(async () => {
      return await $api.folders.delete(id);
    });
  };

  return {
    deleteFolder,
    deleting: deleteOperation.pending,
    error: deleteOperation.error,
    typedError: deleteOperation.typedError,
    result: deleteOperation.data,
  };
}

export function useUpdateFolder(id: string) {
  const { $api } = useNuxtApp();

  // Use centralized operation handling - all errors constructed by FetchFactory
  const updateOperation = useOperation<Folder>();

  const updateFolder = async (
    payload: typeof UpdateFolderDTO | Record<string, unknown>
  ) => {
    return await updateOperation.execute(async () => {
      return await $api.folders.update(id, payload);
    });
  };

  return {
    updateFolder,
    updating: updateOperation.pending,
    error: updateOperation.error,
    typedError: updateOperation.typedError,
  };
}
