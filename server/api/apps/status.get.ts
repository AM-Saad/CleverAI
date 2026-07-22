import { success } from "@server/utils/error";

async function available(url: string) {
  try {
    const response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(750),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (config.appSurface !== "platform") {
    return success({ daily: true, learning: true });
  }
  const [daily, learning] = await Promise.all([
    available(config.dailyUpstream),
    available(config.learningUpstream),
  ]);
  return success({ daily, learning });
});
