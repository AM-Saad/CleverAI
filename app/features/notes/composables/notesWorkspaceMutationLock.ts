const workspaceTails = new Map<string, Promise<void>>();

/**
 * Serializes durable Notes mutations with server acknowledgements per
 * workspace. Memory echoes remain synchronous, while IndexedDB/outbox writes
 * cannot land behind a temp-id acknowledgement and resurrect the temp row.
 */
export async function withNotesWorkspaceMutationLock<T>(
  workspaceId: string,
  work: () => Promise<T>,
): Promise<T> {
  const previous = workspaceTails.get(workspaceId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => gate);
  workspaceTails.set(workspaceId, tail);

  await previous.catch(() => undefined);
  try {
    return await work();
  } finally {
    release();
    if (workspaceTails.get(workspaceId) === tail) {
      workspaceTails.delete(workspaceId);
    }
  }
}
