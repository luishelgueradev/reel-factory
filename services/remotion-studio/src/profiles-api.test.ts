// @vitest-environment node
// profiles-api.test.ts — supertest integration tests for the profiles CRUD + apply routes
//
// Env setup MUST happen before importing the studio app because PROFILES_DIR and
// ACTIVE_PIPELINE_CONFIG_PATH are resolved at module load time. We use a fresh
// temp directory for each test run so tests NEVER touch ./pipeline (PROFILE-04).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import os from "os";
import path from "path";

// ─── Set up isolated temp directories BEFORE importing the app ──────────────

const TEST_PIPELINE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "profiles-api-test-"));
const TEST_PROFILES_DIR = path.join(TEST_PIPELINE_DIR, "profiles");
const TEST_ACTIVE_CONFIG = path.join(TEST_PIPELINE_DIR, "pipeline-config.json");

// Point the module-level constants to our temp dirs BEFORE import
process.env.NODE_ENV = "test";
process.env.PROFILES_DIR = TEST_PROFILES_DIR;
process.env.ACTIVE_PIPELINE_CONFIG_PATH = TEST_ACTIVE_CONFIG;
// Disable basic auth for tests
delete process.env.STUDIO_BASIC_AUTH_USER;
delete process.env.STUDIO_BASIC_AUTH_PASSWORD;
// Use an unreachable mock api-server so no real network calls happen
process.env.API_SERVER_URL = "http://mock-api-server:3000";

// ─── Import the studio app AFTER env/mock setup ──────────────────────────────
import app from "./server.js";

// ─── Minimal valid PipelineConfig fixture ─────────────────────────────────────

const VALID_CONFIG = {
  subtitle: { layout: "tiktok" as const },
};

const VALID_CONFIG_2 = {
  subtitle: { layout: "sentence" as const, fontSize: 60 },
};

// ─── Cleanup ──────────────────────────────────────────────────────────────────

afterAll(() => {
  try {
    fs.rmSync(TEST_PIPELINE_DIR, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
});

// ─── Helper: fresh profiles dir before each test ──────────────────────────────

beforeAll(() => {
  // Ensure profiles dir exists (server creates it at startup via mkdirSync)
  fs.mkdirSync(TEST_PROFILES_DIR, { recursive: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Profiles API — CRUD + apply", () => {

  // ─── POST /api/profiles ──────────────────────────────────────────────────────

  describe("POST /api/profiles", () => {
    it("returns 201 and ProfileFile when body is valid (PROFILE-01)", async () => {
      const res = await request(app)
        .post("/api/profiles")
        .send({ name: "My Test Profile", config: VALID_CONFIG });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe("my-test-profile");
      expect(res.body.name).toBe("My Test Profile");
      expect(res.body.updatedAt).toBeDefined();
      expect(res.body.config).toEqual(VALID_CONFIG);
    });

    it("returns 400 when config fails validatePipelineConfig", async () => {
      const res = await request(app)
        .post("/api/profiles")
        .send({ name: "Bad Config", config: { subtitle: { layout: "invalid-mode" } } });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it("returns 400 when name is missing", async () => {
      const res = await request(app)
        .post("/api/profiles")
        .send({ config: VALID_CONFIG });

      expect(res.status).toBe(400);
    });

    it("returns 400 when config is missing", async () => {
      const res = await request(app)
        .post("/api/profiles")
        .send({ name: "No Config Profile" });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /api/profiles ────────────────────────────────────────────────────────

  describe("GET /api/profiles", () => {
    it("lists saved profiles (PROFILE-01 + PROFILE-03 list)", async () => {
      // Save a profile first
      await request(app)
        .post("/api/profiles")
        .send({ name: "List Test Profile", config: VALID_CONFIG });

      const res = await request(app).get("/api/profiles");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.profiles)).toBe(true);
      const slugs = (res.body.profiles as Array<{ slug: string }>).map((p) => p.slug);
      expect(slugs).toContain("list-test-profile");
    });
  });

  // ─── GET /api/profiles/:slug ─────────────────────────────────────────────────

  describe("GET /api/profiles/:slug", () => {
    it("returns verbatim ProfileFile for a known slug (PROFILE-02 read)", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "Read Test Profile", config: VALID_CONFIG });

      const res = await request(app).get("/api/profiles/read-test-profile");

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("read-test-profile");
      expect(res.body.config).toEqual(VALID_CONFIG);
    });

    it("returns 404 for an unknown slug", async () => {
      const res = await request(app).get("/api/profiles/nonexistent-profile-xyz");

      expect(res.status).toBe(404);
    });

    it("returns 400 for path-traversal slug '../x' (path-traversal guard, D-03)", async () => {
      const res = await request(app).get("/api/profiles/..%2Fx");

      expect(res.status).toBe(400);
    });

    it("returns 400 for slug with dots (e.g. 'a.json')", async () => {
      const res = await request(app).get("/api/profiles/a.json");

      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /api/profiles/:slug/apply ───────────────────────────────────────────

  describe("PUT /api/profiles/:slug/apply", () => {
    it("applies profile, writes to ACTIVE_PIPELINE_CONFIG_PATH, returns applied config (PROFILE-02 + D-05)", async () => {
      // Save a profile with a known config
      await request(app)
        .post("/api/profiles")
        .send({ name: "Apply Test Profile", config: VALID_CONFIG_2 });

      const res = await request(app).put("/api/profiles/apply-test-profile/apply");

      expect(res.status).toBe(200);
      expect(res.body._meta).toEqual(
        expect.objectContaining({ source: "profile", slug: "apply-test-profile" })
      );

      // Verify the active config file on disk now equals the profile's config (PROFILE-02 + active-sync)
      expect(fs.existsSync(TEST_ACTIVE_CONFIG)).toBe(true);
      const written = JSON.parse(fs.readFileSync(TEST_ACTIVE_CONFIG, "utf-8"));
      expect(written.subtitle.layout).toBe("sentence");
      expect(written.subtitle.fontSize).toBe(60);
    });

    it("returns 404 for an unknown slug", async () => {
      const res = await request(app).put("/api/profiles/nonexistent-profile-abc/apply");

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid slug on apply", async () => {
      const res = await request(app).put("/api/profiles/..%2Fevil/apply");

      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH /api/profiles/:slug ────────────────────────────────────────────────

  describe("PATCH /api/profiles/:slug", () => {
    it("renames profile: 200 + new slug in list, old slug gone (PROFILE-03 rename)", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "Rename Source Profile", config: VALID_CONFIG });

      const res = await request(app)
        .patch("/api/profiles/rename-source-profile")
        .send({ name: "Renamed Target Profile" });

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe("renamed-target-profile");
      expect(res.body.name).toBe("Renamed Target Profile");

      // New slug should appear in list
      const listRes = await request(app).get("/api/profiles");
      const slugs = (listRes.body.profiles as Array<{ slug: string }>).map((p) => p.slug);
      expect(slugs).toContain("renamed-target-profile");
      expect(slugs).not.toContain("rename-source-profile");
    });

    it("returns 409 when renaming onto an existing slug (PROFILE-03 conflict)", async () => {
      // Save two profiles
      await request(app)
        .post("/api/profiles")
        .send({ name: "Conflict Alpha", config: VALID_CONFIG });
      await request(app)
        .post("/api/profiles")
        .send({ name: "Conflict Beta", config: VALID_CONFIG });

      // Try to rename Alpha to the same name as Beta → slug collision
      const res = await request(app)
        .patch("/api/profiles/conflict-alpha")
        .send({ name: "Conflict Beta" });

      expect(res.status).toBe(409);
    });

    it("returns 404 for renaming a nonexistent profile", async () => {
      const res = await request(app)
        .patch("/api/profiles/nonexistent-slug-zzz")
        .send({ name: "New Name" });

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /api/profiles/:slug ───────────────────────────────────────────────

  describe("DELETE /api/profiles/:slug", () => {
    it("deletes a profile; 200 then GET list no longer contains it (PROFILE-03 delete)", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "Delete Me Profile", config: VALID_CONFIG });

      const deleteRes = await request(app).delete("/api/profiles/delete-me-profile");
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.deleted).toBe(true);

      // Profile should no longer appear in list
      const listRes = await request(app).get("/api/profiles");
      const slugs = (listRes.body.profiles as Array<{ slug: string }>).map((p) => p.slug);
      expect(slugs).not.toContain("delete-me-profile");
    });

    it("returns 404 when deleting a nonexistent profile (PROFILE-03)", async () => {
      const res = await request(app).delete("/api/profiles/totally-missing-profile");

      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid slug on delete", async () => {
      const res = await request(app).delete("/api/profiles/..%2Fevil");

      expect(res.status).toBe(400);
    });
  });

  // ─── Active-profile pointer + save-writes-active-config (F5 persistence bug) ──
  // Regression for: "create titles → save profile → F5 → titles gone".
  // Root cause was POST /api/profiles never updating the active pipeline config,
  // and the active profile being client-only state lost on reload.

  describe("Active profile + F5 persistence", () => {
    const CONFIG_WITH_TITLE = {
      subtitle: { layout: "tiktok" as const },
      titles: [{ text: "Hola F5", startTimeMs: 0, durationMs: 2000 }],
      overlays: [],
    };

    it("saving a profile writes the titles to the active config (survives F5)", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "F5 Look", config: CONFIG_WITH_TITLE });

      // Simulate F5: GET /api/config must now return the saved titles
      const reload = await request(app).get("/api/config");
      expect(reload.status).toBe(200);
      expect(Array.isArray(reload.body.titles)).toBe(true);
      expect(reload.body.titles).toHaveLength(1);
      expect(reload.body.titles[0].text).toBe("Hola F5");

      // And the active config file on disk reflects it
      const onDisk = JSON.parse(fs.readFileSync(TEST_ACTIVE_CONFIG, "utf-8"));
      expect(onDisk.titles[0].text).toBe("Hola F5");
    });

    it("GET /api/profiles reports the saved profile as activeSlug, and it persists across reloads", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "Active Look", config: VALID_CONFIG });

      const first = await request(app).get("/api/profiles");
      expect(first.body.activeSlug).toBe("active-look");

      // Simulate F5: a fresh GET still reports the same active profile
      const second = await request(app).get("/api/profiles");
      expect(second.body.activeSlug).toBe("active-look");
    });

    it("applying a profile makes it the active profile", async () => {
      await request(app).post("/api/profiles").send({ name: "Apply Source", config: VALID_CONFIG });
      // Save another so the active pointer is something else first
      await request(app).post("/api/profiles").send({ name: "Other Look", config: VALID_CONFIG_2 });
      expect((await request(app).get("/api/profiles")).body.activeSlug).toBe("other-look");

      const applied = await request(app).put("/api/profiles/apply-source/apply");
      expect(applied.status).toBe(200);
      expect((await request(app).get("/api/profiles")).body.activeSlug).toBe("apply-source");
    });

    it("GET /api/profiles includes a look preview (font + active color) per profile", async () => {
      await request(app).post("/api/profiles").send({
        name: "Styled Look",
        config: { subtitle: { layout: "tiktok" as const, fontFamily: "Raleway", activeColor: "#FF00AA", outlineColor: "#000000" } },
      });
      const res = await request(app).get("/api/profiles");
      const styled = (res.body.profiles as Array<{ slug: string; preview?: { fontFamily?: string; activeColor?: string } }>)
        .find((p) => p.slug === "styled-look");
      expect(styled?.preview).toBeDefined();
      expect(styled?.preview?.fontFamily).toBe("Raleway");
      expect(styled?.preview?.activeColor).toBe("#FF00AA");
    });

    it("PUT /api/config syncs the active profile snapshot so export reflects edits", async () => {
      // Create a profile (becomes active) with a yellow active color
      await request(app).post("/api/profiles").send({
        name: "Sync Look",
        config: { subtitle: { layout: "tiktok" as const, activeColor: "#FFFF00" }, titles: [], overlays: [] },
      });
      expect((await request(app).get("/api/profiles")).body.activeSlug).toBe("sync-look");

      // Edit + "Guardar config" (PUT /api/config) — change the color to red
      await request(app).put("/api/config").send({
        subtitle: { layout: "tiktok" as const, activeColor: "#FF0000" }, titles: [], overlays: [],
      });

      // Export = GET the active profile file; it must now reflect the edit (was stale before)
      const exported = await request(app).get("/api/profiles/sync-look");
      expect(exported.body.config.subtitle.activeColor).toBe("#FF0000");
    });

    it("PUT /api/config with no active profile still writes config (no crash)", async () => {
      // Remove any active profile first
      const before = await request(app).get("/api/profiles");
      if (before.body.activeSlug) {
        await request(app).delete(`/api/profiles/${before.body.activeSlug}`);
      }
      const res = await request(app).put("/api/config").send({
        subtitle: { layout: "tiktok" as const }, titles: [], overlays: [],
      });
      expect(res.status).toBe(200);
    });

    it("deleting the active profile clears the active pointer", async () => {
      await request(app).post("/api/profiles").send({ name: "Doomed Look", config: VALID_CONFIG });
      expect((await request(app).get("/api/profiles")).body.activeSlug).toBe("doomed-look");

      await request(app).delete("/api/profiles/doomed-look");
      expect((await request(app).get("/api/profiles")).body.activeSlug).toBeNull();
    });
  });

  // ─── Persistence (PROFILE-04): profiles written under PROFILES_DIR ───────────

  describe("Persistence (PROFILE-04)", () => {
    it("profile file is written under PROFILES_DIR (the bind-mounted ./pipeline/profiles)", async () => {
      await request(app)
        .post("/api/profiles")
        .send({ name: "Persistence Test Profile", config: VALID_CONFIG });

      // Assert the file exists on disk under TEST_PROFILES_DIR
      const expectedPath = path.join(TEST_PROFILES_DIR, "persistence-test-profile.json");
      expect(fs.existsSync(expectedPath)).toBe(true);

      // Verify it contains the correct data
      const content = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
      expect(content.slug).toBe("persistence-test-profile");
      expect(content.config).toEqual(VALID_CONFIG);
    });
  });
});
