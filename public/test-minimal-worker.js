// Minimal standards-compliant service worker used to distinguish a platform
// registration issue from a failure in the production worker bundle.
self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  event.source?.postMessage({ type: 'PONG', data: event.data });
});
