// @vitest-environment node
// profiles.test.ts — Unit proofs for the profiles core module
//
// Uses a real temp dir per test (mkdtemp) — no writes to ./pipeline.
// Verifies: slugify, isValidSlug/profilePath path-traversal guards, CRUD round-trips,
// atomic write (no leftover .tmp), rename collision, removeProfile, malformed-file tolerance.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  slugify,
  isValidSlug,
  profilePath,
  validateProfileName,
  listProfiles,
  readProfile,
  saveProfile,
  renameProfile,
  removeProfile,
  ProfileConflictError,
  ProfileValidationError,
} from "./profiles.js";
import type { PipelineConfig } from "./pipeline-config.js";

// ─── Fixture: minimal but schema-valid PipelineConfig ─────────────────────────

const SAMPLE_CONFIG: PipelineConfig = {
  subtitle: {
    layout: "tiktok",
    fontFamily: "PlusJakartaSans",
    fontSize: 58,
    activeColor: "#FFFF00",
    inactiveColor: "#FFFFFF",
    fontWeight: true,
  },
  titles: [
    {
      text: "Intro",
      startTimeMs: 0,
      durationMs: 2000,
      style: {
        titleFontSize: 48,
        titleColor: "#FFFFFF",
        entranceAnimation: "slide-up",
      },
    },
  ],
  overlays: [
    {
      imageData: "data:image/png;base64,iVBORw0KGgo=",
      x: 100,
      y: 200,
      displayWidth: 300,
      opacity: 0.8,
      layer: "front",
    },
  ],
};

// ─── Temp dir setup ───────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "profiles-test-"));
});

afterEach(async () => {
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
});

// ─── slugify ─────────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts spaces to hyphens and lowercases", () => {
    expect(slugify("Mi Estilo")).toBe("mi-estilo");
  });

  it("strips accents and illegal chars — 'Mi Estilo 🎬' → 'mi-estilo'", () => {
    expect(slugify("Mi Estilo 🎬")).toBe("mi-estilo");
  });

  it("strips accented characters", () => {
    expect(slugify("Español Noticias")).toBe("espanol-noticias");
  });

  it("collapses repeated hyphens", () => {
    expect(slugify("hello   world")).toBe("hello-world");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  --hello--  ")).toBe("hello");
  });

  it("preserves underscores", () => {
    expect(slugify("my_profile_v2")).toBe("my_profile_v2");
  });

  it("caps at 64 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(64);
  });

  it("returns empty string for blank input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  it("returns empty string for purely illegal chars", () => {
    expect(slugify("🎬🎬🎬")).toBe("");
  });
});

// ─── isValidSlug / profilePath ────────────────────────────────────────────────

describe("isValidSlug", () => {
  it("accepts valid slugs", () => {
    expect(isValidSlug("mi-estilo")).toBe(true);
    expect(isValidSlug("profile_v2")).toBe(true);
    expect(isValidSlug("a")).toBe(true);
    expect(isValidSlug("abc123")).toBe(true);
  });

  it("rejects path traversal '../evil'", () => {
    expect(isValidSlug("../evil")).toBe(false);
  });

  it("rejects path with slash 'a/b'", () => {
    expect(isValidSlug("a/b")).toBe(false);
  });

  it("rejects slugs with dot 'a.json'", () => {
    expect(isValidSlug("a.json")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });

  it("rejects just dots '..'", () => {
    expect(isValidSlug("..")).toBe(false);
  });

  it("rejects slugs with backslash", () => {
    expect(isValidSlug("a\\b")).toBe(false);
  });

  it("rejects slugs exceeding 64 chars", () => {
    expect(isValidSlug("a".repeat(65))).toBe(false);
  });

  it("rejects slugs starting with a hyphen", () => {
    expect(isValidSlug("-bad")).toBe(false);
  });

  it("rejects uppercase-only-after-strip", () => {
    // slugify("HELLO") → "hello", but isValidSlug tests the raw value
    expect(isValidSlug("HELLO")).toBe(false);
  });
});

describe("profilePath", () => {
  it("returns the expected path for a valid slug", () => {
    const p = profilePath("/some/dir", "mi-estilo");
    expect(p).toBe("/some/dir/mi-estilo.json");
  });

  it("throws ProfileValidationError for invalid slug '../evil'", () => {
    expect(() => profilePath(tmpDir, "../evil")).toThrowError(ProfileValidationError);
  });

  it("throws for 'a/b'", () => {
    expect(() => profilePath(tmpDir, "a/b")).toThrowError(ProfileValidationError);
  });

  it("throws for 'a.json'", () => {
    expect(() => profilePath(tmpDir, "a.json")).toThrowError(ProfileValidationError);
  });

  it("throws for empty slug", () => {
    expect(() => profilePath(tmpDir, "")).toThrowError(ProfileValidationError);
  });
});

// ─── validateProfileName ─────────────────────────────────────────────────────

describe("validateProfileName", () => {
  it("accepts valid names", () => {
    expect(validateProfileName("Mi Estilo").ok).toBe(true);
  });

  it("rejects empty name", () => {
    const r = validateProfileName("");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("rejects blank name", () => {
    const r = validateProfileName("   ");
    expect(r.ok).toBe(false);
  });

  it("rejects name exceeding 60 chars", () => {
    const r = validateProfileName("a".repeat(61));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/60/);
  });

  it("rejects name that produces an empty slug", () => {
    const r = validateProfileName("🎬🎬🎬");
    expect(r.ok).toBe(false);
  });
});

// ─── saveProfile + listProfiles + readProfile ─────────────────────────────────

describe("saveProfile → listProfiles → readProfile", () => {
  it("saves a profile and lists its summary", async () => {
    await saveProfile(tmpDir, "Mi Estilo", SAMPLE_CONFIG);
    const list = await listProfiles(tmpDir);
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("mi-estilo");
    expect(list[0].name).toBe("Mi Estilo");
    expect(typeof list[0].updatedAt).toBe("string");
  });

  it("readProfile returns the full config verbatim (deep-equal)", async () => {
    await saveProfile(tmpDir, "Mi Estilo", SAMPLE_CONFIG);
    const profile = await readProfile(tmpDir, "mi-estilo");
    expect(profile).not.toBeNull();
    expect(profile!.config).toEqual(SAMPLE_CONFIG);
  });

  it("saveProfile twice with same name = update (one file, newer updatedAt)", async () => {
    const first = await saveProfile(tmpDir, "Mi Estilo", SAMPLE_CONFIG);

    // Brief wait to ensure updatedAt differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updatedConfig: PipelineConfig = {
      ...SAMPLE_CONFIG,
      subtitle: { ...SAMPLE_CONFIG.subtitle, fontSize: 64 },
    };
    const second = await saveProfile(tmpDir, "Mi Estilo", updatedConfig);

    const files = await fs.promises.readdir(tmpDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    expect(jsonFiles).toHaveLength(1); // still only one file

    expect(second.updatedAt >= first.updatedAt).toBe(true);
    const profile = await readProfile(tmpDir, "mi-estilo");
    expect(profile!.config.subtitle.fontSize).toBe(64);
  });

  it("readProfile returns null for non-existent slug", async () => {
    const result = await readProfile(tmpDir, "nonexistent");
    expect(result).toBeNull();
  });

  it("listProfiles returns [] when dir does not exist", async () => {
    const list = await listProfiles(path.join(tmpDir, "does-not-exist"));
    expect(list).toEqual([]);
  });
});

// ─── listProfiles: sort + malformed tolerance ─────────────────────────────────

describe("listProfiles sorting and malformed-file tolerance", () => {
  it("sorts profiles by updatedAt descending", async () => {
    // Save three profiles in sequence; each gets a later updatedAt
    await saveProfile(tmpDir, "Alpha", SAMPLE_CONFIG);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await saveProfile(tmpDir, "Beta", SAMPLE_CONFIG);
    await new Promise((resolve) => setTimeout(resolve, 15));
    await saveProfile(tmpDir, "Gamma", SAMPLE_CONFIG);

    const list = await listProfiles(tmpDir);
    expect(list.map((p) => p.slug)).toEqual(["gamma", "beta", "alpha"]);
  });

  it("skips a malformed *.json without throwing", async () => {
    await saveProfile(tmpDir, "Good Profile", SAMPLE_CONFIG);
    // Write a malformed JSON file
    await fs.promises.writeFile(path.join(tmpDir, "bad.json"), "not-valid-json", "utf-8");
    // Write a structurally wrong but valid JSON file
    await fs.promises.writeFile(
      path.join(tmpDir, "wrong-shape.json"),
      JSON.stringify({ foo: "bar" }),
      "utf-8"
    );

    let list: Awaited<ReturnType<typeof listProfiles>>;
    expect(async () => {
      list = await listProfiles(tmpDir);
    }).not.toThrow();

    list = await listProfiles(tmpDir);
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe("good-profile");
  });
});

// ─── renameProfile ────────────────────────────────────────────────────────────

describe("renameProfile", () => {
  it("changes name and slug, old file gone, new file present", async () => {
    await saveProfile(tmpDir, "Old Name", SAMPLE_CONFIG);

    await renameProfile(tmpDir, "old-name", "New Name");

    const files = await fs.promises.readdir(tmpDir);
    expect(files).not.toContain("old-name.json");
    expect(files).toContain("new-name.json");

    const profile = await readProfile(tmpDir, "new-name");
    expect(profile).not.toBeNull();
    expect(profile!.name).toBe("New Name");
    expect(profile!.slug).toBe("new-name");
    expect(profile!.config).toEqual(SAMPLE_CONFIG);
  });

  it("throws ProfileConflictError when renaming onto an existing different slug", async () => {
    await saveProfile(tmpDir, "Profile A", SAMPLE_CONFIG);
    await saveProfile(tmpDir, "Profile B", SAMPLE_CONFIG);

    // Try to rename A so it collides with B
    await expect(renameProfile(tmpDir, "profile-a", "Profile B")).rejects.toThrowError(
      ProfileConflictError
    );
  });

  it("same-slug rename: only updates the name field, no conflict", async () => {
    await saveProfile(tmpDir, "My Profile", SAMPLE_CONFIG);

    // Rename to a name that produces the same slug
    const result = await renameProfile(tmpDir, "my-profile", "MY Profile");

    expect(result.name).toBe("MY Profile");
    expect(result.slug).toBe("my-profile"); // same slug

    const files = await fs.promises.readdir(tmpDir).then((f) => f.filter((x) => x.endsWith(".json")));
    expect(files).toHaveLength(1);
  });

  it("throws ProfileValidationError if slug to rename does not exist", async () => {
    await expect(renameProfile(tmpDir, "ghost", "New Name")).rejects.toThrowError(
      ProfileValidationError
    );
  });
});

// ─── removeProfile ────────────────────────────────────────────────────────────

describe("removeProfile", () => {
  it("returns true when profile existed", async () => {
    await saveProfile(tmpDir, "To Remove", SAMPLE_CONFIG);
    const result = await removeProfile(tmpDir, "to-remove");
    expect(result).toBe(true);

    const files = await fs.promises.readdir(tmpDir);
    expect(files).not.toContain("to-remove.json");
  });

  it("returns false when profile does not exist", async () => {
    const result = await removeProfile(tmpDir, "nonexistent");
    expect(result).toBe(false);
  });

  it("throws ProfileValidationError for invalid slug", async () => {
    await expect(removeProfile(tmpDir, "../evil")).rejects.toThrowError(ProfileValidationError);
  });
});

// ─── Atomicity smoke test ─────────────────────────────────────────────────────

describe("atomicity", () => {
  it("no leftover .tmp file after saveProfile", async () => {
    await saveProfile(tmpDir, "Atomic Test", SAMPLE_CONFIG);

    const files = await fs.promises.readdir(tmpDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  });

  it("no leftover .tmp file after renameProfile", async () => {
    await saveProfile(tmpDir, "Before Rename", SAMPLE_CONFIG);
    await renameProfile(tmpDir, "before-rename", "After Rename");

    const files = await fs.promises.readdir(tmpDir);
    const tmpFiles = files.filter((f) => f.includes(".tmp"));
    expect(tmpFiles).toHaveLength(0);
  });
});
