export type ClientTempIdScope =
  | "note"
  | "note-group"
  | "board-item"
  | "board-column"
  | "material";

const TEMP_ID_PREFIX_BY_SCOPE: Record<ClientTempIdScope, string> = {
  note: "temp",
  "note-group": "temp-group",
  "board-item": "temp-board-item",
  "board-column": "temp-board-column",
  material: "temp-material",
};

export function createClientTempId(scope: ClientTempIdScope): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

  return `${TEMP_ID_PREFIX_BY_SCOPE[scope]}-${random}`;
}
