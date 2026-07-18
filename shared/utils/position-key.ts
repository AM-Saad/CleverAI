/**
 * Lexicographically sortable fractional position keys. Unlike numeric/floating
 * ranks, repeated inserts between two neighbours never lose precision. Keys
 * are intentionally opaque to callers; use positionBetween rather than
 * parsing or incrementing them.
 */
const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const base = alphabet.length;

function digitAt(key: string | undefined, index: number, fallback: number): number {
  if (!key || index >= key.length) return fallback;
  const digit = alphabet.indexOf(key[index]!);
  if (digit < 0) throw new Error("Invalid position key");
  return digit;
}

export function isPositionKey(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-Za-z]+$/.test(value) && value.length <= 128;
}

/** Return a stable key strictly between the optional lower and upper keys. */
export function positionBetween(lower?: string | null, upper?: string | null): string {
  if (lower && !isPositionKey(lower)) throw new Error("Invalid lower position key");
  if (upper && !isPositionKey(upper)) throw new Error("Invalid upper position key");
  if (lower && upper && lower >= upper) throw new Error("Position bounds are not ordered");

  let prefix = "";
  for (let index = 0; index < 128; index++) {
    const left = digitAt(lower ?? undefined, index, 0);
    const right = digitAt(upper ?? undefined, index, base - 1);
    if (right - left > 1) return prefix + alphabet[Math.floor((left + right) / 2)]!;
    prefix += alphabet[left]!;
  }
  throw new Error("Position key space exhausted; rebalance the collection");
}

/** Give a deterministic fallback key to legacy numeric-order rows. */
export function positionFromLegacyOrder(order: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(order) ? order : 0));
  return safe.toString(36).padStart(12, "0");
}

/** Sort position-aware records while retaining a deterministic legacy fallback. */
export function comparePosition<T extends { position?: string | null; order?: number; id?: string }>(left: T, right: T): number {
  const leftPosition = isPositionKey(left.position) ? left.position : positionFromLegacyOrder(left.order ?? 0);
  const rightPosition = isPositionKey(right.position) ? right.position : positionFromLegacyOrder(right.order ?? 0);
  return leftPosition.localeCompare(rightPosition) || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}
