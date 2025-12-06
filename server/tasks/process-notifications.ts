import { processPendingNotifications } from "../services/NotificationScheduler";

/**
 * Process pending individual card notifications
 * Runs every 15 minutes to send scheduled card reminders
 */
export async function processNotifications() {
  console.log("🔔 Starting pending notifications processing...");

  try {
    const results = await processPendingNotifications();

    console.log("✅ Pending notifications processed:", results);
    return {
      success: true,
      timestamp: new Date().toISOString(),
      results,
    };
  } catch (error) {
    console.error("❌ Error processing pending notifications:", error);
    throw error;
  }
}
