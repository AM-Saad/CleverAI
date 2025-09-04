// server/utils/safeGetServerSession.ts
import { getServerSession } from "#auth"
import type { H3Event } from "h3"

/**
 * Safely gets the server session without throwing errors.
 * Returns null if session is not found or if an error occurs.
 */
export async function safeGetServerSession(event: H3Event): Promise<unknown | null> {
  try {
    const session = await getServerSession(event)
    return session
  } catch (error) {
    console.warn("Session retrieval failed:", error)
    // Log the error but don't throw it
    return null
  }
}
