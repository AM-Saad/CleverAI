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
    cause?: unknown;
    code?: unknown;
    message?: unknown;
    name?: unknown;
    response?: unknown;
    statusCode?: number;
    status?: number;
  };

  // An HTTP response proves reachability even when the response is an error.
  if (
    candidate.response != null ||
    (typeof candidate.statusCode === "number" && candidate.statusCode > 0) ||
    (typeof candidate.status === "number" && candidate.status > 0)
  )
    return false;

  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  const code = typeof candidate.code === "string" ? candidate.code : "";

  if (name === "AbortError" || name === "TimeoutError") return true;
  if (
    [
      "ECONNABORTED",
      "ECONNREFUSED",
      "ECONNRESET",
      "EHOSTUNREACH",
      "ENETUNREACH",
      "ENOTFOUND",
      "ERR_CANCELED",
      "ERR_NETWORK",
      "ETIMEDOUT",
      "EAI_AGAIN",
    ].includes(code)
  )
    return true;

  // ofetch wraps native fetch failures in FetchError and explicitly records
  // that no response was produced.
  if (name === "FetchError") {
    if (message.includes("<no response>")) return true;
    return candidate.cause !== error && isNetworkClassError(candidate.cause);
  }

  // Native browser fetch rejects with TypeError. Restrict this to the
  // cross-browser network messages so an unrelated projection TypeError is not
  // mistaken for an outage.
  if (
    (error instanceof TypeError || name === "TypeError") &&
    /failed to fetch|fetch failed|load failed|network(?:error| request failed)/i.test(
      message,
    )
  )
    return true;

  return candidate.cause !== error && isNetworkClassError(candidate.cause);
}
