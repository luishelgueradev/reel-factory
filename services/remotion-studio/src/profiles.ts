// ─── profiles.ts — Pure, framework-free core for named config profiles ───────
// Phase 24: Named Config Profiles
// Per D-01 (storage = bind mount), D-02 (profile file shape), D-03 (slug = file id),
// D-04 (atomic writes), D-06 (pure core, injected dir), D-07 (validation on read),
// D-11 (list sorted by updatedAt desc).
//
// No Express / no globals. All functions accept a `dir` parameter so they are
// unit-testable with a real temp directory.

import fs from "fs";
import path from "path";
import { validatePipelineConfig } from "./pipeline-config.js";
import type { PipelineConfig, SubtitleConfig, TitleStyleProps } from "./pipeline-config.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A tiny visual digest of a profile's "look" — the salient style axes the
 * dropdown mini-specimen renders so a saved profile reads as a whole
 * configuration at a glance, not just a name (sketch 034-A).
 */
export interface ProfilePreview {
  fontFamily?: string;
  activeColor?: string;
  outlineColor?: string;
  fontWeight?: boolean;
  titleText?: string;
  titleColor?: string;
  titleBg?: string;
}

/** A lightweight summary suitable for list views */
export interface ProfileSummary {
  slug: string;
  name: string;
  updatedAt: string;
  preview?: ProfilePreview;
}

/** Distills a config's caption + first-title look into a ProfilePreview. */
function extractPreview(config: PipelineConfig): ProfilePreview {
  const s: Partial<SubtitleConfig> = config.subtitle ?? {};
  const firstTitle = Array.isArray(config.titles) ? config.titles[0] : undefined;
  const ts: Partial<TitleStyleProps> = firstTitle?.style ?? {};
  const preview: ProfilePreview = {
    fontFamily: s.fontFamily,
    activeColor: s.activeColor,
    outlineColor: s.outlineColor,
    fontWeight: s.fontWeight,
  };
  if (firstTitle?.text) preview.titleText = firstTitle.text.slice(0, 14);
  if (ts.textColor) preview.titleColor = ts.textColor;
  if (ts.backgroundColor) preview.titleBg = ts.backgroundColor;
  return preview;
}

/** The full on-disk representation of a profile */
export interface ProfileFile extends ProfileSummary {
  config: PipelineConfig;
}

// ─── Error classes ────────────────────────────────────────────────────────────

/**
 * Thrown when renaming a profile would overwrite an existing profile with a
 * different slug. Maps to HTTP 409 in the server layer.
 */
export class ProfileConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileConflictError";
  }
}

/**
 * Thrown for invalid profile names or slugs. Maps to HTTP 400 in the server layer.
 */
export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SLUG_LENGTH = 64;
const MAX_NAME_LENGTH = 60;

// ─── Slug utilities ───────────────────────────────────────────────────────────

/**
 * Derives a safe slug from a display name.
 *
 * Steps:
 *   1. Normalize unicode (NFD) to strip accent combining chars.
 *   2. Lowercase.
 *   3. Replace any character that is NOT [a-z0-9_-] with "-".
 *   4. Collapse consecutive "-" into one.
 *   5. Strip leading/trailing "-".
 *   6. Truncate to MAX_SLUG_LENGTH.
 *
 * Returns "" if the result is empty (caller should treat as validation failure).
 */
export function slugify(name: string): string {
  if (!name || typeof name !== "string") return "";
  const slug = name
    .normalize("NFD")                          // decompose accented chars
    .replace(/[̀-ͯ]/g, "")           // strip combining diacritics
    .replace(/\s+/g, "-")                      // spaces → "-"
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")             // illegal chars → "-"
    .replace(/-{2,}/g, "-")                    // collapse repeated "-"
    .replace(/^-+|-+$/g, "")                   // strip leading/trailing "-"
    .slice(0, MAX_SLUG_LENGTH);

  return slug;
}

/**
 * Returns true when `slug` is a safe, non-traversable file identifier.
 *
 * Rules (D-03):
 * - Matches `^[a-z0-9][a-z0-9_-]*$` (starts with alphanumeric).
 * - Length 1–MAX_SLUG_LENGTH.
 * - No ".", "/", or "\" (path-traversal guard).
 */
export function isValidSlug(slug: string): boolean {
  if (!slug || typeof slug !== "string") return false;
  if (slug.length > MAX_SLUG_LENGTH) return false;
  if (slug.includes(".") || slug.includes("/") || slug.includes("\\")) return false;
  return /^[a-z0-9][a-z0-9_-]*$/.test(slug);
}

/**
 * Validates a display name for a profile.
 * Returns { ok: true } or { ok: false, error: "..." }.
 */
export function validateProfileName(name: string): { ok: boolean; error?: string } {
  if (!name || typeof name !== "string") {
    return { ok: false, error: "Profile name must be a non-empty string" };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "Profile name must not be blank" };
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Profile name must be ${MAX_NAME_LENGTH} characters or fewer` };
  }
  const slug = slugify(trimmed);
  if (!slug) {
    return { ok: false, error: "Profile name produces an empty slug — use letters or numbers" };
  }
  return { ok: true };
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the absolute path to a profile JSON file inside `dir`.
 * Throws ProfileValidationError if the slug is invalid (anti path-traversal).
 */
export function profilePath(dir: string, slug: string): string {
  if (!isValidSlug(slug)) {
    throw new ProfileValidationError(
      `Invalid slug "${slug}" — slugs must match ^[a-z0-9][a-z0-9_-]*$ and contain no path separators`
    );
  }
  return path.join(dir, `${slug}.json`);
}

// ─── CRUD operations ──────────────────────────────────────────────────────────

/**
 * Lists all valid profiles in `dir`, sorted by updatedAt descending (D-11).
 * Malformed / invalid files are skipped with a console.warn (D-07).
 * Returns [] if the directory does not exist.
 */
export async function listProfiles(dir: string): Promise<ProfileSummary[]> {
  if (!fs.existsSync(dir)) return [];

  let entries: string[];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return [];
  }

  const jsonFiles = entries.filter((e) => e.endsWith(".json"));
  const summaries: ProfileSummary[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(dir, file);
    try {
      const raw = await fs.promises.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      // Validate required fields
      if (
        typeof parsed.slug !== "string" ||
        typeof parsed.name !== "string" ||
        typeof parsed.updatedAt !== "string" ||
        typeof parsed.config !== "object" ||
        parsed.config === null
      ) {
        console.warn(`[profiles] Skipping malformed profile: ${file} — missing required fields`);
        continue;
      }

      // Validate config with PipelineConfig validator (D-07)
      const validation = validatePipelineConfig(parsed.config);
      if (!validation.valid) {
        console.warn(
          `[profiles] Skipping malformed profile: ${file} — invalid config: ${validation.errors.join(", ")}`
        );
        continue;
      }

      summaries.push({
        slug: parsed.slug as string,
        name: parsed.name as string,
        updatedAt: parsed.updatedAt as string,
        preview: extractPreview(parsed.config as PipelineConfig),
      });
    } catch (err) {
      console.warn(`[profiles] Skipping unreadable profile: ${file} —`, err instanceof Error ? err.message : err);
    }
  }

  // Sort by updatedAt descending (most recently touched first, D-11)
  summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return summaries;
}

/**
 * Reads a single profile by slug.
 * Returns null if the file does not exist.
 * Throws ProfileValidationError if the slug is invalid.
 */
export async function readProfile(dir: string, slug: string): Promise<ProfileFile | null> {
  const filePath = profilePath(dir, slug); // throws on invalid slug

  if (!fs.existsSync(filePath)) return null;

  const raw = await fs.promises.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  return {
    slug: parsed.slug as string,
    name: parsed.name as string,
    updatedAt: parsed.updatedAt as string,
    config: parsed.config as PipelineConfig,
  };
}

/**
 * Saves (or overwrites) a profile.
 *
 * - Validates the name and config.
 * - Slugifies the name to derive the file id.
 * - Ensures the directory exists.
 * - Writes ATOMICALLY via temp file + rename (D-04).
 *
 * Returns the written ProfileFile.
 */
export async function saveProfile(
  dir: string,
  name: string,
  config: PipelineConfig
): Promise<ProfileFile> {
  const nameValidation = validateProfileName(name);
  if (!nameValidation.ok) {
    throw new ProfileValidationError(nameValidation.error!);
  }

  const configValidation = validatePipelineConfig(config);
  if (!configValidation.valid) {
    throw new ProfileValidationError(
      `Invalid config: ${configValidation.errors.join(", ")}`
    );
  }

  const slug = slugify(name.trim());
  if (!isValidSlug(slug)) {
    throw new ProfileValidationError(`Derived slug "${slug}" is invalid`);
  }

  // Ensure directory exists
  await fs.promises.mkdir(dir, { recursive: true });

  const profileData: ProfileFile = {
    name: name.trim(),
    slug,
    updatedAt: new Date().toISOString(),
    config,
  };

  const targetPath = profilePath(dir, slug);
  await atomicWrite(targetPath, JSON.stringify(profileData, null, 2));

  return profileData;
}

/**
 * Renames a profile, moving its file if the slug changes.
 *
 * - If newSlug === oldSlug: updates the name field in-place (atomic write).
 * - If newSlug !== oldSlug and target already exists: throws ProfileConflictError (PROFILE-03).
 * - Writes new file atomically, then deletes the old file.
 *
 * Returns the updated ProfileFile.
 */
export async function renameProfile(
  dir: string,
  slug: string,
  newName: string
): Promise<ProfileFile> {
  const existing = await readProfile(dir, slug);
  if (!existing) {
    throw new ProfileValidationError(`Profile "${slug}" does not exist`);
  }

  const nameValidation = validateProfileName(newName);
  if (!nameValidation.ok) {
    throw new ProfileValidationError(nameValidation.error!);
  }

  const newSlug = slugify(newName.trim());
  if (!isValidSlug(newSlug)) {
    throw new ProfileValidationError(`Derived slug "${newSlug}" from name "${newName}" is invalid`);
  }

  const updatedProfile: ProfileFile = {
    name: newName.trim(),
    slug: newSlug,
    updatedAt: new Date().toISOString(),
    config: existing.config,
  };

  if (newSlug !== slug) {
    // Check for conflict — target slug already exists
    const newPath = profilePath(dir, newSlug);
    if (fs.existsSync(newPath)) {
      throw new ProfileConflictError(
        `A profile with slug "${newSlug}" already exists — choose a different name`
      );
    }

    // Write new file atomically
    await atomicWrite(newPath, JSON.stringify(updatedProfile, null, 2));

    // Delete old file
    const oldPath = profilePath(dir, slug);
    await fs.promises.unlink(oldPath);
  } else {
    // Same slug: update name field in-place
    const targetPath = profilePath(dir, slug);
    await atomicWrite(targetPath, JSON.stringify(updatedProfile, null, 2));
  }

  return updatedProfile;
}

/**
 * Removes a profile by slug.
 * Returns true if the file existed and was deleted, false if it did not exist.
 * Throws ProfileValidationError if the slug is invalid.
 */
export async function removeProfile(dir: string, slug: string): Promise<boolean> {
  const filePath = profilePath(dir, slug); // throws on invalid slug

  if (!fs.existsSync(filePath)) return false;

  await fs.promises.unlink(filePath);
  return true;
}

// ─── Active-profile pointer (D-05 follow-up: which profile is "current") ───────
// Persisted so the Studio UI can show the active profile after a page reload (F5).
// Stored as a plain-text slug in a NON-".json" file so listProfiles() ignores it.

const ACTIVE_POINTER_FILE = ".active-profile";

/**
 * Returns the slug of the currently-active profile, or null if none is set
 * (or the pointed-at profile no longer exists / the pointer is corrupt).
 */
export async function getActiveProfileSlug(dir: string): Promise<string | null> {
  const pointerPath = path.join(dir, ACTIVE_POINTER_FILE);
  if (!fs.existsSync(pointerPath)) return null;
  try {
    const raw = (await fs.promises.readFile(pointerPath, "utf-8")).trim();
    if (!isValidSlug(raw)) return null;
    // Only report active if the profile file still exists (avoids dangling pointer)
    if (!fs.existsSync(profilePath(dir, raw))) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Sets (or clears, when slug === null) the active-profile pointer.
 * Writes atomically via temp file + rename (D-04). No-op cleanup on clear.
 */
export async function setActiveProfileSlug(dir: string, slug: string | null): Promise<void> {
  await fs.promises.mkdir(dir, { recursive: true });
  const pointerPath = path.join(dir, ACTIVE_POINTER_FILE);

  if (slug === null) {
    try {
      await fs.promises.unlink(pointerPath);
    } catch {
      // already absent — fine
    }
    return;
  }

  if (!isValidSlug(slug)) {
    throw new ProfileValidationError(`Invalid active-profile slug "${slug}"`);
  }

  // Non-".json" temp so a mid-write glimpse never trips listProfiles()
  const tmpPath = path.join(dir, `${ACTIVE_POINTER_FILE}.${process.pid}.${Date.now()}.tmp`);
  try {
    await fs.promises.writeFile(tmpPath, slug, "utf-8");
    fs.renameSync(tmpPath, pointerPath);
  } catch (err) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Atomically writes `content` to `targetPath`.
 * Writes to a `.{basename}.{pid}.{ts}.tmp.json` temp file in the same directory,
 * then renames (D-04). Cleans up the temp file if write fails.
 */
async function atomicWrite(targetPath: string, content: string): Promise<void> {
  const dir = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  const tmpPath = path.join(dir, `.${baseName}.${process.pid}.${Date.now()}.tmp.json`);

  try {
    await fs.promises.writeFile(tmpPath, content, "utf-8");
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {
      // ignore cleanup error
    }
    throw err;
  }
}
