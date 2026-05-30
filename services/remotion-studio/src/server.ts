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
import crypto from "crypto";
import { validatePipelineConfig } from "./pipeline-config.js";
import type { PipelineConfig } from "./pipeline-config.js";

const PORT = parseInt(process.env.PORT || "3123", 10);
const PIPELINE_CONFIG_PATH = process.env.PIPELINE_CONFIG_PATH || "";
const INPUT_PATH = process.env.INPUT_PATH || "";
// D-04: Single source of truth for the write destination — read once at module load.
// resolveConfigPath() is still used for GET reads (job-scoped preview); writes go here only.
const ACTIVE_PIPELINE_CONFIG_PATH =
  process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";

const app = express();

// Middleware
// WR-02: Restrict CORS to the studio's own origin rather than the wildcard '*'.
// Wildcard CORS conflicts with the Basic Auth model: it lets any web page read
// /api/config when auth is disabled, and permanently prevents credentials:include
// mode if auth is later used cross-origin.
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGIN || `http://localhost:${PORT}`,
  credentials: true,
}));

// ─── HTTP Basic Auth ────────────────────────────────────────────────────────
// Protects the studio (incl. the write endpoints PUT /api/config and POST
// /api/render) when it is exposed publicly via the Cloudflare tunnel.
//
// - Credentials come from STUDIO_BASIC_AUTH_USER / STUDIO_BASIC_AUTH_PASSWORD.
//   If either is unset, auth is DISABLED (local-only / pipeline-internal use).
// - Loopback requests bypass auth so the Docker healthcheck (which curls
//   localhost:3123/api/config from inside the container) keeps the service
//   healthy. Tunnel traffic arrives from the cloudflared container's network
//   address — never loopback — so it is always challenged.
const BASIC_AUTH_USER = process.env.STUDIO_BASIC_AUTH_USER || "";
const BASIC_AUTH_PASSWORD = process.env.STUDIO_BASIC_AUTH_PASSWORD || "";

function isLoopback(ip: string | undefined): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function safeEqual(a: string, b: string): boolean {
  // WR-01: Hash both inputs to fixed 32-byte digests so timingSafeEqual always
  // executes for the same duration regardless of string length, eliminating
  // the credential-length oracle that the early `length !== length` check exposed.
  const key = Buffer.alloc(32); // zero key — only used to produce equal-length buffers
  const ha = crypto.createHmac("sha256", key).update(a).digest();
  const hb = crypto.createHmac("sha256", key).update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.use((req, res, next) => {
  // Auth disabled when no credentials are configured.
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) return next();
  // Bypass for in-container loopback traffic (healthcheck).
  if (isLoopback(req.socket.remoteAddress ?? undefined)) return next();

  const header = req.headers.authorization || "";
  if (header.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep !== -1) {
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (safeEqual(user, BASIC_AUTH_USER) && safeEqual(pass, BASIC_AUTH_PASSWORD)) {
        return next();
      }
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="reel-factory studio"');
  return res.status(401).send("Authentication required");
});

app.use(express.json({ limit: "10mb" })); // Raised to 10mb for base64 PNG overlay payloads (Phase 21 D-10).

// ─── Health check ──────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "remotion-studio", port: PORT });
});

// ─── Diagnostics endpoint ──────────────────────────────────────────────────

app.post("/api/diag", (req, res) => {
  // WR-05: The global express.json({ limit: "1mb" }) already parsed the body before
  // this route fires, so an inline express.json({ limit: "10kb" }) here is a no-op.
  // Enforce the 10 KB limit manually to prevent log flooding via unauthenticated POST.
  const raw = JSON.stringify(req.body);
  if (raw.length > 10_000) {
    return res.status(413).json({ error: "Payload too large" });
  }
  console.log("[diag] Browser errors:", raw.slice(0, 2000));
  res.json({ received: true });
});

// ─── GET /api/config — Read pipeline-config.json (D-19, D-03) ──────────────

app.get("/api/config", (_req, res) => {
  const configPath = resolveConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
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
    // Write config, stripping _meta if present. JSX auto-escaping in TitleOverlay
    // renders title text safely — no HTML sanitization needed here.
    const { _meta, ...configToWrite } = body as PipelineConfig & { _meta?: unknown };

    // D-04: Write ONLY to ACTIVE_PIPELINE_CONFIG_PATH (single source of truth).
    // resolveConfigPath() is NOT called here — it is used only by GET for job-scoped reads.
    const activeDir = path.dirname(ACTIVE_PIPELINE_CONFIG_PATH);
    if (!fs.existsSync(activeDir)) {
      fs.mkdirSync(activeDir, { recursive: true });
    }
    // CR-02: Atomic write — write to temp file then rename so a process kill
    // mid-write never leaves a truncated/corrupt pipeline-config.json.
    const tmpPath = path.join(
      activeDir,
      `.pipeline-config.${process.pid}.${Date.now()}.tmp.json`
    );
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(configToWrite, null, 2), "utf-8");
      fs.renameSync(tmpPath, ACTIVE_PIPELINE_CONFIG_PATH);
    } catch (writeErr) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
      throw writeErr;
    }
    console.log("[studio] Config written to:", ACTIVE_PIPELINE_CONFIG_PATH);

    return res.json({
      ...configToWrite,
      _meta: { source: "file", valid: true, path: ACTIVE_PIPELINE_CONFIG_PATH },
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

function serveSpa(_req: express.Request, res: express.Response) {
  const indexHtml = path.join(EDITOR_DIST, "index.html");
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).json({
      error: "Editor SPA not built",
      message: "Run 'npm run build:editor' to build the config editor SPA",
    });
  }
}

// ─── Serve unified StudioApp SPA at / (18-03 D-02) ──────────────────────────
// API routes (/api/*) are all registered above — they must appear before this
// static middleware to prevent express.static from intercepting API calls.
// T-18-03-01: API ordering verified at registration time (lines 96-203 above).

app.use("/", express.static(EDITOR_DIST));      // serves /assets/... and any static file

app.get("/", serveSpa);                          // root → unified StudioApp

// 301 redirects: old /editor and /preview routes → canonical /
app.get("/editor",           (_req, res) => res.redirect(301, "/"));
app.get("/editor/",          (_req, res) => res.redirect(301, "/"));
app.get("/editor/{*splat}",  (_req, res) => res.redirect(301, "/"));
app.get("/preview",          (_req, res) => res.redirect(301, "/"));
app.get("/preview/",         (_req, res) => res.redirect(301, "/"));
app.get("/preview/{*splat}", (_req, res) => res.redirect(301, "/"));

// SPA catch-all: any unmatched path → serve index.html (client-side routing)
app.get("/{*splat}", serveSpa);

// ─── Helper: Resolve config file path ──────────────────────────────────────

function resolveConfigPath(): string {
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

  // Local dev: read from ACTIVE_PIPELINE_CONFIG_PATH so GET and PUT stay in sync.
  // Fall back to local file only when ACTIVE_PIPELINE_CONFIG_PATH is also unset.
  if (ACTIVE_PIPELINE_CONFIG_PATH) {
    return ACTIVE_PIPELINE_CONFIG_PATH;
  }
  return path.join(process.cwd(), "pipeline-config.json");
}

// ─── Start server ───────────────────────────────────────────────────────────

export const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[remotion-studio] Config API and Editor SPA listening on port ${PORT}`);
  console.log(`  GET  /api/config  — Read pipeline config`);
  console.log(`  PUT  /api/config  — Write pipeline config`);
  console.log(`  POST /api/render  — Render trigger (not yet implemented)`);
  console.log(`  GET  /editor      — Config Editor SPA`);
  console.log(`  GET  /preview     — Subtitle Preview SPA`);
  console.log(`  PIPELINE_CONFIG_PATH: ${PIPELINE_CONFIG_PATH || "(not set, using local fallback)"}`);
  console.log(`  INPUT_PATH: ${INPUT_PATH || "(not set)"}`);
  console.log(`  Config file: ${resolveConfigPath()}`);
});

export default app;