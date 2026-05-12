import express from "express";
import multer from "multer";
import { processRouter, UnsupportedMediaTypeError, FileTooLargeError } from "./routes/process.js";
import { artifactsRouter } from "./routes/artifacts.js";

const app = express();

// Parse JSON request bodies
app.use(express.json());

// Mount route handlers
app.use(processRouter);
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

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
  });
}

export { app };