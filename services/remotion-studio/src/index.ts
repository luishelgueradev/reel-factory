// ─── Remotion Studio entry point ──────────────────────────────────────────
// Starts the Express server for config API.
// Remotion Studio is served separately via `npx remotion studio` (D-15).

import { server } from "./server.js";

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[remotion-studio] SIGTERM received, shutting down");
  server.close(() => {
    console.log("[remotion-studio] Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[remotion-studio] SIGINT received, shutting down");
  server.close(() => {
    console.log("[remotion-studio] Server closed");
    process.exit(0);
  });
});