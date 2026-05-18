// ─── Remotion Studio: Express server for live preview + config API ────────
// Per D-14, D-15, D-18:
// - Serves Remotion Studio for live preview of compositions
// - Provides GET/PUT /api/config endpoints for pipeline-config.json
// - Reads pipeline-config.json from shared volume (D-19)
// - Validates config writes against PipelineConfig schema (T-06-09)

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { validatePipelineConfig } from "./pipeline-config.js";
import type { PipelineConfig, TitleConfig } from "./pipeline-config.js";

// ─── HTML sanitization for XSS prevention (CR-02) ──────────────────────────

function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeTitles(titles: TitleConfig[]): TitleConfig[] {
  return titles.map(t => ({
    ...t,
    text: sanitizeHtml(t.text),
    subtitle: t.subtitle ? sanitizeHtml(t.subtitle) : undefined,
  }));
}

const PORT = parseInt(process.env.PORT || "3123", 10);
const PIPELINE_CONFIG_PATH = process.env.PIPELINE_CONFIG_PATH || "";
const INPUT_PATH = process.env.INPUT_PATH || "";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ─── Health check ──────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "remotion-studio", port: PORT });
});

// ─── GET /api/config — Read pipeline-config.json (D-19, D-03) ──────────────

app.get("/api/config", (_req, res) => {
  const configPath = resolveConfigPath();

  if (!configPath) {
    // No config path configured — return defaults (D-03: graceful fallback)
    return res.json({
      subtitle: { layout: "tiktok" },
      titles: [],
      _meta: { source: "defaults", reason: "no PIPELINE_CONFIG_PATH set" },
    });
  }

  try {
    if (!fs.existsSync(configPath)) {
      // Config file doesn't exist yet — return defaults (D-03)
      return res.json({
        subtitle: { layout: "tiktok" },
        titles: [],
        _meta: { source: "defaults", reason: "config file not found", path: configPath },
      });
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    const validation = validatePipelineConfig(parsed);

    if (!validation.valid) {
      // Config file exists but is invalid — still return it, flag issues
      return res.json({
        ...parsed,
        _meta: { source: "file", valid: false, errors: validation.errors, path: configPath },
      });
    }

    return res.json({
      ...parsed,
      _meta: { source: "file", valid: true, path: configPath },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error reading config";
    console.error("[studio] Error reading config:", message);
    return res.status(500).json({
      subtitle: { layout: "tiktok" },
      titles: [],
      _meta: { source: "defaults", reason: "error reading config", error: message },
    });
  }
});

// ─── PUT /api/config — Write pipeline-config.json (D-16, T-06-09) ──────────
// ⚠️ WR-06: This endpoint has no authentication. It is intended for use within
// a trusted internal Docker network only. Before exposing this API externally,
// add authentication (API key, JWT, etc.) and rate limiting.

app.put("/api/config", (req, res) => {
  const configPath = resolveConfigPath();

  if (!configPath) {
    return res.status(400).json({
      error: "PIPELINE_CONFIG_PATH not configured",
      message: "Set PIPELINE_CONFIG_PATH env var to enable config writes",
    });
  }

  const body = req.body;

  // Validate against PipelineConfig schema (T-06-09)
  const validation = validatePipelineConfig(body);
  if (!validation.valid) {
    return res.status(400).json({
      error: "Invalid config",
      errors: validation.errors,
    });
  }

  try {
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write config, stripping _meta if present, sanitizing title text (CR-02)
    const { _meta, ...configToWrite } = body as PipelineConfig & { _meta?: unknown };
    // CR-02: Sanitize title text to prevent stored XSS — strip/escape HTML
    if (configToWrite.titles && Array.isArray(configToWrite.titles)) {
      configToWrite.titles = sanitizeTitles(configToWrite.titles);
    }
    fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 2));

    console.log("[studio] Config written to:", configPath);
    return res.json({
      ...configToWrite,
      _meta: { source: "file", valid: true, path: configPath },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error writing config";
    console.error("[studio] Error writing config:", message);
    return res.status(500).json({
      error: "Failed to write config",
      message,
    });
  }
});

// ─── POST /api/render — Render trigger placeholder (D-20, future Plan 05) ─

app.post("/api/render", (_req, res) => {
  res.status(501).json({
    status: "not_implemented",
    message: "Render trigger not yet configured. Will be implemented in Plan 05.",
  });
});

// ─── Serve static files from public/ (D-06: sample video) ────────────────────
// Per D-06: Sample video bundled in public/ directory for the preview page.
// Also used by Remotion Player for staticFile('/sample-video.mp4').

const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || "public");
app.use(express.static(PUBLIC_DIR));

// ─── Serve editor SPA at /editor (D-16) ────────────────────────────────────────

const EDITOR_DIST = path.resolve(process.env.EDITOR_DIST || "dist/editor");

app.use("/editor", express.static(EDITOR_DIST));

// SPA fallback: serve index.html for any /editor route that doesn't match a static file
app.get("/editor/{*splat}", (_req, res) => {
  const indexHtml = path.join(EDITOR_DIST, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({
      error: "Editor SPA not built",
      message: "Run 'npm run build:editor' to build the config editor SPA",
    });
  }
});

// ─── Serve preview SPA at /preview (D-01, D-02) ──────────────────────────────
// Per D-02: Single SPA with routing — /preview shares the same Vite build as /editor.
// Both routes serve the same index.html; React Router handles client-side routing.

app.get("/preview", (_req, res) => {
  const indexHtml = path.join(EDITOR_DIST, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({
      error: "Preview SPA not built",
      message: "Run 'npm run build:editor' to build the SPA",
    });
  }
});

app.get("/preview/{*splat}", (_req, res) => {
  const indexHtml = path.join(EDITOR_DIST, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({
      error: "Preview SPA not built",
      message: "Run 'npm run build:editor' to build the SPA",
    });
  }
});

// ─── Helper: Resolve config file path ──────────────────────────────────────

function resolveConfigPath(): string | null {
  // PIPELINE_CONFIG_PATH takes precedence (D-19)
  if (PIPELINE_CONFIG_PATH) {
    return PIPELINE_CONFIG_PATH;
  }

  // Fallback: derive from INPUT_PATH (standard pipeline pattern)
  if (INPUT_PATH) {
    // INPUT_PATH = /data/pipeline/{job_id}/remotion-renderer/output.mp4
    // Config should be at /data/pipeline/{job_id}/remotion-renderer/pipeline-config.json
    const inputDir = path.dirname(INPUT_PATH);
    return path.join(inputDir, "pipeline-config.json");
  }

  return null;
}

// ─── Start server ───────────────────────────────────────────────────────────

export const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[remotion-studio] Config API and Editor SPA listening on port ${PORT}`);
  console.log(`  GET  /api/config  — Read pipeline config`);
  console.log(`  PUT  /api/config  — Write pipeline config`);
  console.log(`  POST /api/render  — Render trigger (not yet implemented)`);
  console.log(`  GET  /editor      — Config Editor SPA`);
  console.log(`  GET  /preview     — Subtitle Preview SPA`);
  console.log(`  PIPELINE_CONFIG_PATH: ${PIPELINE_CONFIG_PATH || "(not set)"}`);
  console.log(`  INPUT_PATH: ${INPUT_PATH || "(not set)"}`);
});

export default app;