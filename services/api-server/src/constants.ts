/**
 * API server constants.
 * Uses PIPELINE_DATA_DIR env var (overridable for testing),
 * defaulting to /data/pipeline (same as shared/constants.ts in Docker).
 */

export const PIPELINE_DATA_DIR = process.env.PIPELINE_DATA_DIR || "/data/pipeline";