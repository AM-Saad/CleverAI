/**
 * Classify a thrown fetch error as network-class — the request never produced an
 * HTTP response (DNS failure, dead link, captive portal, abort/timeout).
 *
 * A 4xx/5xx is NOT network-class: the server was reachable and answered, so it
 * must not be treated as a connectivity signal or counted against a sync retry
 * ceiling differently from any other server refusal.
 *
 * Lives in utils rather than the network composable so non-Vue consumers (the
 * offline runtime, the service-worker bundle, unit tests) can import it without
 * pulling in Vue reactivity.
 */
export function isNetworkClassError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    response?: unknown;
    statusCode?: number;
    status?: number;
  };
  return !candidate.response && !candidate.statusCode && !candidate.status;
}
