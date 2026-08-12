import { cronManager } from "../services/CronManager";
import { checkDueCards } from "../tasks/check-due-cards";
import { checkDueActions } from "../tasks/check-due-actions";

export default defineNitroPlugin(async (nitroApp) => {
  // Only initialize cron jobs on the server side and not in development API routes
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_CRON === "true"
  ) {
    console.log("🕐 Initializing cron jobs...");

    try {
      // Register tasks
      cronManager.registerTask("check-due-cards", async () => {
        await checkDueCards();
      });
      cronManager.registerTask("check-due-actions", async () => {
        await checkDueActions();
      });

      // Add jobs with configuration from environment
      const jobConfigs = [
        {
          name: "check-due-cards",
          schedule: process.env.CRON_CHECK_DUE_CARDS_SCHEDULE || "0 */4 * * *", // Every 4 hours
          taskName: "check-due-cards" as const,
          timezone: process.env.CRON_CHECK_DUE_CARDS_TIMEZONE || "UTC",
          enabled: true,
        },
        {
          name: "check-due-actions",
          // Keep the interval <= ACTION_REMINDER_WINDOW_MINUTES or reminders slip.
          schedule: process.env.CRON_CHECK_DUE_ACTIONS_SCHEDULE || "*/5 * * * *",
          taskName: "check-due-actions" as const,
          timezone: "UTC",
          enabled: true,
        },
      ];

      await cronManager.loadJobs(jobConfigs);
      cronManager.startAll();

      console.log("✅ Cron jobs initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize cron jobs:", error);
    }

    // Graceful shutdown
    nitroApp.hooks.hook("close", async () => {
      console.log("🛑 Shutting down cron jobs...");
      cronManager.stopAll();
    });
  } else {
    console.log("⏸️ Cron jobs disabled (development mode)");
  }
});
