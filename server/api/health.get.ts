export default defineEventHandler(async () => {
  // TEMP DIAGNOSTIC: emulate real-world RTT
  await new Promise((r) => setTimeout(r, 300));
  return { ok: true };
});
