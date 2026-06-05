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
import { Readable } from "node:stream";
import { validatePipelineConfig } from "./pipeline-config.js";
import type { PipelineConfig } from "./pipeline-config.js";
import {
  listProfiles,
  readProfile,
  saveProfile,
  renameProfile,
  removeProfile,
  isValidSlug,
  getActiveProfileSlug,
  setActiveProfileSlug,
  ProfileConflictError,
  ProfileValidationError,
} from "./profiles.js";
import {
  generateMetadata,
  PLATFORMS,
  TONES,
  EmptyTranscriptError,
  MetadataValidationError,
} from "./metadata.js";

const PORT = parseInt(process.env.PORT || "3123", 10);
const PIPELINE_CONFIG_PATH = process.env.PIPELINE_CONFIG_PATH || "";
const INPUT_PATH = process.env.INPUT_PATH || "";
// Upstream api-server URL — configurable for tests. In production, api-server is
// reachable at http://api-server:3000 on pipeline-net (D-03).
const API_SERVER_URL = process.env.API_SERVER_URL || "http://api-server:3000";
// D-04: Single source of truth for the write destination.
// resolveConfigPath() is still used for GET reads (job-scoped preview); writes go here only.
// Read lazily (via function) so tests that set process.env.ACTIVE_PIPELINE_CONFIG_PATH
// after module load (module cached across test files) still get the overridden path.
function getActivePipelineConfigPath(): string {
  return process.env.ACTIVE_PIPELINE_CONFIG_PATH || "/data/pipeline/pipeline-config.json";
}

// D-01, D-08: Profiles stored under dirname(getActivePipelineConfigPath())/profiles/.
// PROFILES_DIR is env-overridable so tests can redirect to a temp dir without
// touching the real ./pipeline directory.
// Read lazily (via function) so tests can set process.env.PROFILES_DIR
// after module load (e.g. when the module is cached across test files).
function getProfilesDir(): string {
  return (
    process.env.PROFILES_DIR ||
    path.join(path.dirname(getActivePipelineConfigPath()), "profiles")
  );
}

// D-08: Ensure the profiles directory exists at startup (idempotent mkdir -p).
// Guarded under NODE_ENV=test / VITEST so tests can point PROFILES_DIR at a
// temp dir before importing the module without triggering a permission error on
// the default /data/pipeline/profiles path. The route handlers (saveProfile)
// also call mkdir recursively on first write, providing belt-and-suspenders.
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  fs.mkdirSync(getProfilesDir(), { recursive: true });
}

// ─── Metadata API — lazy getters (Phase 25, D-03, D-04, AI-SPEC §3) ────────────
// Read lazily so tests can set process.env.* after module load (module-caching lesson).

function getMetadataApiUrl(): string {
  return process.env.METADATA_API_URL || "http://host.docker.internal:3210";
}

function getMetadataApiKey(): string {
  return process.env.METADATA_API_KEY || "";
}

function getMetadataModel(): string {
  return process.env.METADATA_MODEL || "big-cloud";
}

// PIPELINE_DATA_DIR holds {jobId}/... — used to read transcript.json + write metadata.json.
// Override via PIPELINE_DATA_DIR env so tests can use a temp dir (module-caching lesson).
// Production default: dirname(ACTIVE_PIPELINE_CONFIG_PATH) = /data/pipeline.
function getPipelineDataDir(): string {
  if (process.env.PIPELINE_DATA_DIR) return process.env.PIPELINE_DATA_DIR;
  return path.dirname(getActivePipelineConfigPath());
}

// ─── Typed router errors ───────────────────────────────────────────────────────

class RouterNotConfiguredError extends Error {
  constructor() {
    super("router no configurado: METADATA_API_KEY no está configurado");
    this.name = "RouterNotConfiguredError";
  }
}

class RouterError extends Error {
  readonly status: number;
  constructor(status: number, body: string) {
    super(`Router devolvió HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "RouterError";
    this.status = status;
  }
}

// ─── Real ChatClient — calls the local-llms router (AI-SPEC §3) ────────────────
// POST ${url}/v1/chat/completions, Bearer key, json_object mode, ~90s timeout.
// Logs X-Model-Backend + X-Cost-Cents for observability (AI-SPEC §7).
// Throws RouterNotConfiguredError if key is empty (→ 503 at the route level).

async function routerChatClient({
  system,
  user,
}: {
  system: string;
  user: string;
}): Promise<string> {
  const key = getMetadataApiKey();
  if (!key) throw new RouterNotConfiguredError();

  const url = getMetadataApiUrl();
  const model = getMetadataModel();

  const response = await fetch(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  // Log observability headers (AI-SPEC §7)
  const backend = response.headers.get("x-model-backend") ?? "unknown";
  const cost = response.headers.get("x-cost-cents") ?? "unknown";
  console.log(`[metadata] router backend=${backend} cost_cents=${cost} status=${response.status}`);

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    throw new RouterError(response.status, body);
  }

  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Atomic write for job data (metadata.json) ────────────────────────────────
// Mirrors atomicWriteConfig but operates on arbitrary job-dir files.

function atomicWriteJobFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (writeErr) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw writeErr;
  }
}

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

    // D-04: Write ONLY to getActivePipelineConfigPath() (single source of truth).
    // resolveConfigPath() is NOT called here — it is used only by GET for job-scoped reads.
    atomicWriteConfig(configToWrite);
    console.log("[studio] Config written to:", getActivePipelineConfigPath());

    return res.json({
      ...configToWrite,
      _meta: { source: "file", valid: true, path: getActivePipelineConfigPath() },
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

// ─── POST /api/render — Streaming multipart proxy to api-server POST /batch ─
// RENDER-01: forwards the upload to the queue path so jobId is returned
// immediately (not /process which blocks until the render completes).
// The browser uploads under field name "videos" (batch.ts upload.array("videos")).
// duplex:"half" is REQUIRED for Node 22 fetch to stream a request body (RESEARCH Pitfall 3).
// No multer/body-parser in the Studio: the multipart boundary must survive to api-server.

app.post("/api/render", async (req, res) => {
  try {
    const upstream = await fetch(API_SERVER_URL + "/batch", {
      method: "POST",
      headers: {
        "content-type": req.headers["content-type"] ?? "",
        ...(req.headers["content-length"]
          ? { "content-length": req.headers["content-length"] }
          : {}),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: req as any,
      // @ts-expect-error — duplex:"half" is required by Node 22 fetch for streaming request bodies
      duplex: "half",
    });

    const data = await upstream.json() as unknown;
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { step: "proxy", message: String(err) } });
  }
});

// ─── UUID validation regex — copied verbatim from api-server/src/routes/status.ts L20-24 ─
// T-23-02-01, T-23-02-02: gate BEFORE forwarding to upstream (400 without calling fetch).
const JOB_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── GET /api/status/:jobId — Relay job progress JSON (RENDER-02) ───────────
// UUID-validates jobId, then proxies GET /status/:jobId from api-server verbatim.
// Returns { jobId, status, currentStep, progress, stepInfo, steps, startedAt, error }.

app.get("/api/status/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!JOB_ID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId format" });
  }

  try {
    const upstream = await fetch(API_SERVER_URL + "/status/" + jobId);
    const data = await upstream.json() as unknown;
    return res.status(upstream.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: { step: "proxy", message: String(err) } });
  }
});

// ─── GET /api/result/:jobId — Range-aware finished MP4 proxy (RENDER-04) ─────
// UUID-validates jobId, proxies the finished video from the quality-finalizer step.
// Step name and filename are PINNED (not request-derived) — T-23-02-01 path-traversal mitigation.
// Forwards inbound Range header; relays content-type/content-length/accept-ranges/content-range.
// ?download=1 adds Content-Disposition: attachment for browser download.

const RESULT_STEP = "quality-finalizer";
const RESULT_FILENAME = "output.mp4";

app.get("/api/result/:jobId", async (req, res) => {
  const { jobId } = req.params;

  if (!JOB_ID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId format" });
  }

  const upstreamUrl =
    API_SERVER_URL + "/artifacts/" + jobId + "/" + RESULT_STEP + "/" + RESULT_FILENAME;

  const fetchHeaders: Record<string, string> = {};
  if (req.headers["range"]) {
    fetchHeaders["range"] = req.headers["range"];
  }

  try {
    const upstream = await fetch(upstreamUrl, { headers: fetchHeaders });

    // Relay relevant headers
    const relayHeaders = ["content-type", "content-length", "accept-ranges", "content-range"];
    for (const h of relayHeaders) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }

    if (req.query["download"] === "1") {
      res.setHeader("content-disposition", 'attachment; filename="reel.mp4"');
    }

    res.status(upstream.status);

    // Stream body — non-null assertion safe: fetch body is always present for a real response.
    // Wrap in a Promise so Express 5 async handler waits for stream completion.
    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(upstream.body!).pipe(res)
        .on("finish", resolve)
        .on("error", reject);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: { step: "proxy", message: String(err) } });
    }
  }
});

// ─── Profiles CRUD + apply routes (Phase 24, D-05, D-06) ─────────────────────
// All 6 routes are registered BEFORE the serveSpa catch-all (T-18-03-01).
// getProfilesDir() is called per-request so PROFILES_DIR env override set in
// test files takes effect even when server.ts is already module-cached (D-08).

// GET /api/profiles — List profiles (PROFILE-03 list)
app.get("/api/profiles", async (_req, res) => {
  try {
    const dir = getProfilesDir();
    const profiles = await listProfiles(dir);
    const activeSlug = await getActiveProfileSlug(dir);
    return res.json({ profiles, activeSlug });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error listing profiles:", message);
    return res.status(500).json({ error: "Failed to list profiles", message });
  }
});

// POST /api/profiles — Save a new profile (PROFILE-01)
app.post("/api/profiles", async (req, res) => {
  const { name, config } = req.body as { name?: unknown; config?: unknown };

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required and must be a non-empty string" });
  }

  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "config is required and must be an object" });
  }

  // Validate PipelineConfig before saving
  const configValidation = validatePipelineConfig(config);
  if (!configValidation.valid) {
    return res.status(400).json({
      error: "Invalid config",
      errors: configValidation.errors,
    });
  }

  try {
    const dir = getProfilesDir();
    const profile = await saveProfile(dir, name, config as PipelineConfig);
    // Persist the saved look as the active pipeline config so the user's current
    // work survives a page reload (F5), and mark it as the active profile.
    // Without this, saving a profile left pipeline-config.json untouched and the
    // titles/overlays vanished on reload (GET /api/config reads the active config).
    atomicWriteConfig(profile.config);
    await setActiveProfileSlug(dir, profile.slug);
    return res.status(201).json(profile);
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return res.status(400).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error saving profile:", message);
    return res.status(500).json({ error: "Failed to save profile", message });
  }
});

// GET /api/profiles/:slug — Read a single profile (PROFILE-02 read)
app.get("/api/profiles/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: `Invalid slug "${slug}"` });
  }

  try {
    const profile = await readProfile(getProfilesDir(), slug);
    if (!profile) {
      return res.status(404).json({ error: `Profile "${slug}" not found` });
    }
    return res.json(profile);
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return res.status(400).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error reading profile:", message);
    return res.status(500).json({ error: "Failed to read profile", message });
  }
});

// PUT /api/profiles/:slug/apply — Apply profile → atomically update active config (PROFILE-02, D-05)
app.put("/api/profiles/:slug/apply", async (req, res) => {
  const { slug } = req.params;

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: `Invalid slug "${slug}"` });
  }

  try {
    const profile = await readProfile(getProfilesDir(), slug);
    if (!profile) {
      return res.status(404).json({ error: `Profile "${slug}" not found` });
    }

    // D-07: Validate the stored config before applying (422 if malformed/hand-edited profile)
    const configValidation = validatePipelineConfig(profile.config);
    if (!configValidation.valid) {
      return res.status(422).json({
        error: "Profile config is invalid and cannot be applied",
        errors: configValidation.errors,
      });
    }

    // D-05: Atomically write the profile's config to getActivePipelineConfigPath()
    atomicWriteConfig(profile.config);
    // Mark this profile as active so the Studio UI shows it after a reload (F5)
    await setActiveProfileSlug(getProfilesDir(), slug);
    console.log(`[studio] Profile "${slug}" applied to:`, getActivePipelineConfigPath());

    return res.json({
      ...profile.config,
      _meta: {
        source: "profile",
        slug,
        path: getActivePipelineConfigPath(),
      },
    });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return res.status(400).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error applying profile:", message);
    return res.status(500).json({ error: "Failed to apply profile", message });
  }
});

// PATCH /api/profiles/:slug — Rename profile (PROFILE-03 rename)
app.patch("/api/profiles/:slug", async (req, res) => {
  const { slug } = req.params;
  const { name } = req.body as { name?: unknown };

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: `Invalid slug "${slug}"` });
  }

  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required and must be a non-empty string" });
  }

  try {
    const dir = getProfilesDir();
    const wasActive = (await getActiveProfileSlug(dir)) === slug;
    const updated = await renameProfile(dir, slug, name);
    // Keep the active pointer following a renamed-active profile across a slug change
    if (wasActive && updated.slug !== slug) {
      await setActiveProfileSlug(dir, updated.slug);
    }
    return res.json(updated);
  } catch (err) {
    if (err instanceof ProfileConflictError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof ProfileValidationError) {
      // renameProfile throws ProfileValidationError if the profile doesn't exist
      // or the new name is invalid. Distinguish 404 vs 400 by message content.
      if (err.message.includes("does not exist")) {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error renaming profile:", message);
    return res.status(500).json({ error: "Failed to rename profile", message });
  }
});

// DELETE /api/profiles/:slug — Delete profile (PROFILE-03 delete)
app.delete("/api/profiles/:slug", async (req, res) => {
  const { slug } = req.params;

  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: `Invalid slug "${slug}"` });
  }

  try {
    const dir = getProfilesDir();
    const wasActive = (await getActiveProfileSlug(dir)) === slug;
    const existed = await removeProfile(dir, slug);
    if (!existed) {
      return res.status(404).json({ error: `Profile "${slug}" not found` });
    }
    // Clear the active pointer if the deleted profile was active
    if (wasActive) {
      await setActiveProfileSlug(dir, null);
    }
    return res.json({ deleted: true });
  } catch (err) {
    if (err instanceof ProfileValidationError) {
      return res.status(400).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[studio] Error deleting profile:", message);
    return res.status(500).json({ error: "Failed to delete profile", message });
  }
});

// ─── POST /api/metadata — Generate social metadata via router (Phase 25, D-01) ─
// Body: { jobId, platform, tone }
// Reads {jobId}/whisper/transcript.json, calls routerChatClient, validates,
// persists to {jobId}/metadata.json (atomic), returns { title, description,
// hashtags, _meta: { backend, model } }.
// All error paths return JSON; never throws uncaught.

app.post("/api/metadata", async (req, res) => {
  const { jobId, platform, tone } = req.body as {
    jobId?: unknown;
    platform?: unknown;
    tone?: unknown;
  };

  // Validate jobId
  if (typeof jobId !== "string" || !JOB_ID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "jobId inválido — se requiere UUID v4" });
  }

  // Validate platform
  if (typeof platform !== "string" || !Object.prototype.hasOwnProperty.call(PLATFORMS, platform)) {
    return res.status(400).json({
      error: `platform inválido — valores permitidos: ${Object.keys(PLATFORMS).join(", ")}`,
    });
  }

  // Validate tone
  if (typeof tone !== "string" || !Object.prototype.hasOwnProperty.call(TONES, tone)) {
    return res.status(400).json({
      error: `tone inválido — valores permitidos: ${Object.keys(TONES).join(", ")}`,
    });
  }

  const transcriptPath = path.join(
    getPipelineDataDir(),
    jobId,
    "whisper",
    "transcript.json"
  );

  // Read transcript
  let transcript: unknown;
  try {
    if (!fs.existsSync(transcriptPath)) {
      return res.status(404).json({
        error: `Transcript no encontrado para jobId ${jobId}`,
        path: transcriptPath,
      });
    }
    const raw = fs.readFileSync(transcriptPath, "utf-8");
    transcript = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[metadata] Error reading transcript:", message);
    return res.status(500).json({ error: "Error leyendo el transcript", message });
  }

  // Generate metadata via router
  try {
    const metadata = await generateMetadata({
      transcript,
      platform: platform as keyof typeof PLATFORMS,
      tone: tone as keyof typeof TONES,
      client: routerChatClient,
    });

    // Persist atomically (D-05)
    const metadataPath = path.join(getPipelineDataDir(), jobId, "metadata.json");
    atomicWriteJobFile(metadataPath, metadata);

    const model = getMetadataModel();
    console.log(`[metadata] Generated for jobId=${jobId} platform=${platform} tone=${tone} model=${model}`);

    return res.status(200).json({
      ...metadata,
      _meta: { model },
    });
  } catch (err) {
    if (err instanceof RouterNotConfiguredError) {
      return res.status(503).json({ error: "router no configurado", message: err.message });
    }
    if (err instanceof RouterError) {
      return res.status(502).json({ error: "Router devolvió un error", message: err.message });
    }
    if (err instanceof EmptyTranscriptError) {
      return res.status(422).json({ error: err.message });
    }
    if (err instanceof MetadataValidationError) {
      return res.status(502).json({ error: "No se pudo validar la metadata", detail: err.message });
    }
    // Timeout from AbortSignal
    if (err instanceof Error && err.name === "TimeoutError") {
      return res.status(502).json({ error: "Timeout al llamar al router (90s)" });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[metadata] Unexpected error generating metadata:", message);
    return res.status(500).json({ error: "Error inesperado generando metadata", message });
  }
});

// ─── GET /api/metadata/:jobId — Re-serve persisted metadata.json (D-05) ────────
// Returns 200 with persisted metadata, or 404 if not yet generated.

app.get("/api/metadata/:jobId", (req, res) => {
  const { jobId } = req.params;

  if (!JOB_ID_REGEX.test(jobId)) {
    return res.status(400).json({ error: "jobId inválido — se requiere UUID v4" });
  }

  const metadataPath = path.join(getPipelineDataDir(), jobId, "metadata.json");

  if (!fs.existsSync(metadataPath)) {
    return res.status(404).json({ error: `No hay metadata generada para jobId ${jobId}` });
  }

  try {
    const raw = fs.readFileSync(metadataPath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    return res.status(200).json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[metadata] Error reading metadata.json:", message);
    return res.status(500).json({ error: "Error leyendo metadata", message });
  }
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
// T-18-03-01: API ordering verified at registration time (routes above).

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

// Exported (with injectable deps) so the resolution order is unit-testable without
// booting the server or mutating process.env. Production callers use resolveConfigPath().
export function resolveConfigPathWith(deps: {
  pipelineConfigPath?: string;
  inputPath?: string;
  activePath?: string;
  fileExists?: (p: string) => boolean;
  cwd?: string;
}): string {
  const pipelineConfigPath = deps.pipelineConfigPath ?? "";
  const inputPath = deps.inputPath ?? "";
  const activePath = deps.activePath ?? "";
  const fileExists = deps.fileExists ?? fs.existsSync;
  const cwd = deps.cwd ?? process.cwd();

  // PIPELINE_CONFIG_PATH (job-scoped preview) takes precedence (D-19) — but ONLY when
  // the file actually exists. A stale or empty PIPELINE_JOB_ID resolves to a
  // non-existent job path; in that case we must fall back to the active config so the
  // Studio shows the real saved settings (and any applied profile) instead of bare
  // defaults. Without this guard, applying a profile appears to do nothing after a
  // reload because GET would keep returning defaults for the missing job path.
  // (Phase 24 robustness — surfaced by named profiles; benefits Phase 17 active-config too.)
  if (pipelineConfigPath && fileExists(pipelineConfigPath)) {
    return pipelineConfigPath;
  }

  // Derive from INPUT_PATH (standard pipeline pattern), if that derived file exists.
  if (inputPath) {
    // INPUT_PATH = /data/pipeline/{job_id}/remotion-renderer/output.mp4
    // Config would be at /data/pipeline/{job_id}/remotion-renderer/pipeline-config.json
    const derived = path.join(path.dirname(inputPath), "pipeline-config.json");
    if (fileExists(derived)) {
      return derived;
    }
  }

  // Active config — the normal Studio-editing scenario (GET and PUT stay in sync).
  if (activePath) {
    return activePath;
  }
  return path.join(cwd, "pipeline-config.json");
}

function resolveConfigPath(): string {
  return resolveConfigPathWith({
    pipelineConfigPath: PIPELINE_CONFIG_PATH,
    inputPath: INPUT_PATH,
    activePath: getActivePipelineConfigPath(),
  });
}

// ─── Helper: Atomic write to getActivePipelineConfigPath() (CR-02, D-04) ─────
// Shared by PUT /api/config and PUT /api/profiles/:slug/apply.
// Writes to a temp file then renames so a crash mid-write never corrupts the config.

function atomicWriteConfig(config: PipelineConfig): void {
  const activeDir = path.dirname(getActivePipelineConfigPath());
  if (!fs.existsSync(activeDir)) {
    fs.mkdirSync(activeDir, { recursive: true });
  }
  const tmpPath = path.join(
    activeDir,
    `.pipeline-config.${process.pid}.${Date.now()}.tmp.json`
  );
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), "utf-8");
    fs.renameSync(tmpPath, getActivePipelineConfigPath());
  } catch (writeErr) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
    throw writeErr;
  }
}

// ─── Start server ───────────────────────────────────────────────────────────
// Guarded so importing server.ts under vitest/NODE_ENV=test does NOT bind
// port 3123, mirroring api-server/src/index.ts L93.

export let server: ReturnType<typeof app.listen> | undefined;

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[remotion-studio] Config API and Editor SPA listening on port ${PORT}`);
    console.log(`  GET  /api/config  — Read pipeline config`);
    console.log(`  PUT  /api/config  — Write pipeline config`);
    console.log(`  POST /api/render  — Render trigger`);
    console.log(`  GET  /api/status/:jobId  — Job status relay`);
    console.log(`  GET  /api/result/:jobId  — Finished MP4 proxy`);
    console.log(`  GET  /api/profiles  — List profiles`);
    console.log(`  POST /api/profiles  — Save profile`);
    console.log(`  GET  /api/profiles/:slug  — Read profile`);
    console.log(`  PUT  /api/profiles/:slug/apply  — Apply profile`);
    console.log(`  PATCH /api/profiles/:slug  — Rename profile`);
    console.log(`  DELETE /api/profiles/:slug  — Delete profile`);
    console.log(`  POST /api/metadata  — Generate social metadata`);
    console.log(`  GET  /api/metadata/:jobId  — Re-serve persisted metadata`);
    console.log(`  GET  /editor      — Config Editor SPA`);
    console.log(`  GET  /preview     — Subtitle Preview SPA`);
    console.log(`  PIPELINE_CONFIG_PATH: ${PIPELINE_CONFIG_PATH || "(not set, using local fallback)"}`);
    console.log(`  INPUT_PATH: ${INPUT_PATH || "(not set)"}`);
    console.log(`  Config file: ${resolveConfigPath()}`);
    console.log(`  Profiles dir: ${getProfilesDir()}`);
  });
}

export default app;
