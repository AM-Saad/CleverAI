import {
  createLocalFirstErrorPolicy,
  type LocalFirstErrorPolicy,
} from "../../../utils/local-first/errorPolicy";
import { logNotesOperation } from "./notesOperationLog";

export type NotesErrorPolicy = LocalFirstErrorPolicy;

export function createNotesErrorPolicy(options?: {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterPct?: number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}): NotesErrorPolicy {
  return createLocalFirstErrorPolicy({
    ...options,
    onRetryScheduled: ({ workspaceId, reason, attempt, delay }) => {
      logNotesOperation("sync-failure", {
        workspaceId,
        reason,
        attempt,
        delay,
      });
    },
  });
}
