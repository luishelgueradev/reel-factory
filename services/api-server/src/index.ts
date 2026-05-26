import express from "express";
import multer from "multer";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import path from "path";
import { processRouter, UnsupportedMediaTypeError, FileTooLargeError } from "./routes/process.js";
import { artifactsRouter } from "./routes/artifacts.js";
import { healthRouter } from "./routes/health.js";
import { batchRouter } from "./routes/batch.js";
import { statusRouter } from "./routes/status.js";
import { startWorker, stopWorker } from "./worker.js";
import { closeQueueConnection } from "./queue.js";
import { ACTIVE_PIPELINE_CONFIG_PATH } from "./constants.js";

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Mount route handlers — health check first for fast liveness probing
app.use(healthRouter);
app.use(processRouter);
app.use(batchRouter);
app.use(statusRouter);
app.use(artifactsRouter);

// 404 fallback handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (Express 5: 4-argument middleware)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Multer file size limit error (LIMIT_FILE_SIZE)
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "File size exceeds 500MB limit" });
    return;
  }

  // Multer file count limit error (LIMIT_FILE_COUNT / LIMIT_UNEXPECTED_FILE) — batch upload exceeding MAX_BATCH_SIZE
  if (err instanceof multer.MulterError && (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT")) {
    res.status(413).json({ error: "Too many files in batch" });
    return;
  }

  // Custom error classes from process route
  if (err instanceof FileTooLargeError) {
    res.status(413).json({ error: err.message });
    return;
  }

  if (err instanceof UnsupportedMediaTypeError || err.message === "Only MP4 files are accepted") {
    res.status(415).json({ error: "Only MP4 files are accepted" });
    return;
  }

  // Generic error
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server if not in test mode
const PORT = parseInt(process.env.PORT || "3000", 10);

// D-06: Seed default config on fresh install.
// If the active config is missing, copy the git-tracked default template into place.
// Runs once at startup; never throws — a failure logs and falls through gracefully.
// DEFAULT_CONFIG_PATH is baked into the Docker image via COPY config/ ./config/ in the Dockerfile.
const DEFAULT_CONFIG_PATH =
  process.env.DEFAULT_CONFIG_PATH || "/app/config/pipeline-config.default.json";

function seedDefaultConfig(): void {
  // Idempotent: do NOT overwrite user's saved config (T-17-04)
  if (existsSync(ACTIVE_PIPELINE_CONFIG_PATH)) return;
  if (!existsSync(DEFAULT_CONFIG_PATH)) {
    console.warn(
      `[api-server] Default config template not found at ${DEFAULT_CONFIG_PATH}; skipping seed`
    );
    return;
  }
  try {
    mkdirSync(path.dirname(ACTIVE_PIPELINE_CONFIG_PATH), { recursive: true });
    copyFileSync(DEFAULT_CONFIG_PATH, ACTIVE_PIPELINE_CONFIG_PATH);
    console.log(
      `[api-server] Seeded default config: ${DEFAULT_CONFIG_PATH} → ${ACTIVE_PIPELINE_CONFIG_PATH}`
    );
  } catch (err) {
    console.warn(
      `[api-server] Could not seed default config (will use env fallbacks): ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

if (process.env.NODE_ENV !== "test") {
  // Seed default config before starting the server (D-06)
  seedDefaultConfig();

  const server = app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });

  // Start BullMQ worker alongside the Express server (per D-12)
  const worker = startWorker();

  // Graceful shutdown on SIGTERM/SIGINT
  const gracefulShutdown = async () => {
    console.log("Shutting down...");
    await stopWorker(worker);
    await closeQueueConnection();
    server.close(() => {
      process.exit(0);
    });
    // Force exit after 10s if server.close doesn't complete
    setTimeout(() => process.exit(1), 10000);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

export { app };