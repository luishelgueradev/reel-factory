/**
 * API server constants.
 * Uses env vars (overridable for testing), with sensible defaults.
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

/**
 * Maximum number of files per batch request.
 * Per D-10: configurable via MAX_BATCH_SIZE env var, default 10.
 * NaN from non-numeric env vars coerces to the default.
 */
export const MAX_BATCH_SIZE = Number(parseInt(process.env.MAX_BATCH_SIZE || "10", 10)) || 10;

/**
 * Maximum number of concurrent pipeline jobs processed by the BullMQ worker.
 * Per D-08: configurable via MAX_CONCURRENT_JOBS env var, default 2.
 * Prevents resource contention when processing multiple videos simultaneously.
 * NaN from non-numeric env vars coerces to the default.
 */
export const MAX_CONCURRENT_JOBS = Number(parseInt(process.env.MAX_CONCURRENT_JOBS || "2", 10)) || 2;

/**
 * Redis connection URL.
 * Defaults to localhost for development; in Docker, overridden via REDIS_URL env var (redis://redis:6379).
 */
export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";