// Minimal test worker
console.log("✅ Minimal worker loaded!");

self.addEventListener("message", (e) => {
  console.log("Worker received message:", e.data);
  self.postMessage({ type: "PONG", data: e.data });
});

// Send ready immediately
self.postMessage({ type: "READY" });
