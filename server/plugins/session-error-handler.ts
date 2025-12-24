export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("error", (error, { event }) => {
    console.log(event)
    console.error("Nitro error:", {
      path: event?.path,
      message: error.message,
    });
  });
});
