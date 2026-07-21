import { normalizeWorkspaceNoteTitle } from "./workspaceNote";

export interface ComparableNoteSyncState {
  groupId?: string | null;
  title?: string | null;
  content?: string;
  tags?: string[];
  noteType?: string | null;
  metadata?: unknown;
}

function canonicalizeJson(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeJson(entry)]),
  );
}

/**
 * A retry can legitimately arrive after the server committed the same note but
 * the acknowledgement was lost. In that case the version changed while the
 * complete user-visible note state did not, so both sides have already
 * converged and no manual conflict exists.
 */
export function areNoteSyncStatesEquivalent(
  local: ComparableNoteSyncState,
  server: ComparableNoteSyncState,
): boolean {
  const serverContent = server.content ?? "";
  const localContent = local.content ?? serverContent;

  return (
    (local.content === undefined || localContent === serverContent) &&
    (local.title === undefined ||
      normalizeWorkspaceNoteTitle(local.title, localContent) ===
        normalizeWorkspaceNoteTitle(server.title, serverContent)) &&
    (local.groupId === undefined ||
      (local.groupId ?? null) === (server.groupId ?? null)) &&
    (local.noteType === undefined ||
      local.noteType === (server.noteType ?? "TEXT")) &&
    (local.tags === undefined ||
      JSON.stringify(local.tags) === JSON.stringify(server.tags ?? [])) &&
    (local.metadata === undefined ||
      JSON.stringify(canonicalizeJson(local.metadata)) ===
        JSON.stringify(canonicalizeJson(server.metadata)))
  );
}
