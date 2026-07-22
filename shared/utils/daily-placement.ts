import type { ActionOccurrenceDTO, ActionPlacementDTO } from "./daily.contract";

export function placementStateAfterMove(
  occurrenceStatus: ActionOccurrenceDTO["status"],
): ActionPlacementDTO["state"] {
  return occurrenceStatus === "COMPLETED" ? "COMPLETED" : "ACTIVE";
}
