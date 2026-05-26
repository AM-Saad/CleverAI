import { createClientTempId } from "../../../utils/local-first/tempIds";

export function createNotesTempId(prefix: "temp" | "temp-group" = "temp"): string {
  return createClientTempId(prefix === "temp-group" ? "note-group" : "note");
}
