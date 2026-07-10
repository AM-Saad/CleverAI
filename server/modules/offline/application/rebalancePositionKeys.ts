import { positionBetween } from "@@/shared/utils/position-key";

/** Assign fresh, evenly spaced lexical keys in the caller's intended order. */
export async function rebalancePositionKeys(input: {
  prisma: any;
  model: "workspace" | "note" | "noteGroup" | "boardItem" | "boardColumn" | "userTag";
  ids: string[];
}) {
  let previous: string | undefined;
  for (const id of input.ids) {
    const position = positionBetween(previous, null);
    await input.prisma[input.model].update({ where: { id }, data: { position } });
    previous = position;
  }
}
