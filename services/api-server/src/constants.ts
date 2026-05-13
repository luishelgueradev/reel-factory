/**
 * API server constants.
 * Uses PIPELINE_DATA_DIR env var (overridable for testing),
 * defaulting to /data/pipeline (same as shared/constants.ts in Docker).
 */

export const PIPELINE_DATA_DIR = process.env.PIPELINE_DATA_DIR || "/data/pipeline";

/**
 * Docker network name for pipeline containers.
 * Uses PIPELINE_NETWORK env var (overridable for testing).
 * Docker Compose prefixes network names with the project name,
 * so the default is "reel-factory_pipeline-net" to match
 * the network created by docker compose.
 */
export const PIPELINE_NETWORK = process.env.PIPELINE_NETWORK || "reel-factory_pipeline-net";

/**
 * Host-side path to the pipeline data directory.
 * Used for Docker volume bind mounts when creating sibling containers.
 * Inside the container, PIPELINE_DATA_DIR is /data/pipeline, but
 * the host path (which Docker bind mounts reference) is different.
 * Set HOST_PIPELINE_DIR to the absolute host path (e.g., /home/user/project/pipeline).
 */
export const HOST_PIPELINE_DIR = process.env.HOST_PIPELINE_DIR || "/data/pipeline";