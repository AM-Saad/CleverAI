/**
 * Returns mutations in a stable dependency-first order. Dependencies are
 * mutation IDs (not entity IDs), which lets a child safely wait for a parent
 * create to receive its server ID. Invalid cycles are reported instead of
 * silently being sent in timestamp order.
 */
export function orderOfflineMutations<T extends { id: string; createdAt: number; dependsOn: string[] }>(
  mutations: T[],
): { ordered: T[]; cyclic: T[] } {
  const byId = new Map(mutations.map((mutation) => [mutation.id, mutation]));
  const pending = new Map<string, number>();
  const children = new Map<string, T[]>();

  for (const mutation of mutations) {
    const localDependencies = mutation.dependsOn.filter((dependency) => byId.has(dependency));
    pending.set(mutation.id, localDependencies.length);
    for (const dependency of localDependencies) {
      const list = children.get(dependency) ?? [];
      list.push(mutation);
      children.set(dependency, list);
    }
  }

  const compare = (left: T, right: T) => left.createdAt - right.createdAt || left.id.localeCompare(right.id);
  const ready = mutations.filter((mutation) => pending.get(mutation.id) === 0).sort(compare);
  const ordered: T[] = [];
  while (ready.length) {
    const mutation = ready.shift()!;
    ordered.push(mutation);
    for (const child of children.get(mutation.id) ?? []) {
      const next = (pending.get(child.id) ?? 1) - 1;
      pending.set(child.id, next);
      if (next === 0) {
        ready.push(child);
        ready.sort(compare);
      }
    }
  }

  return {
    ordered,
    cyclic: mutations.filter((mutation) => !ordered.some((item) => item.id === mutation.id)).sort(compare),
  };
}
