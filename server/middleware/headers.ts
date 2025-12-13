export default defineEventHandler((event) => {
  // Cross-Origin Isolation headers for SharedArrayBuffer support
  // Using 'credentialless' instead of 'require-corp' to allow CDN imports in workers
  setHeader(event, "Cross-Origin-Embedder-Policy", "credentialless");
  setHeader(event, "Cross-Origin-Opener-Policy", "same-origin");

  // Add CORP header to allow same-origin resources (including workers) to load
  setHeader(event, "Cross-Origin-Resource-Policy", "same-origin");
});
