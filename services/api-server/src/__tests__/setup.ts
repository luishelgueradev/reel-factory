import { beforeAll, afterAll, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Use a temp directory for test uploads to avoid polluting /data/pipeline
export const TEST_PIPELINE_DIR = await fs.mkdtemp(
  path.join(os.tmpdir(), "api-server-test-")
);

// Override PIPELINE_DATA_DIR for tests
process.env.PIPELINE_DATA_DIR = TEST_PIPELINE_DIR;

beforeAll(async () => {
  // Ensure test pipeline directory exists
  await fs.mkdir(TEST_PIPELINE_DIR, { recursive: true });
});

afterAll(async () => {
  // Clean up temp directory
  await fs.rm(TEST_PIPELINE_DIR, { recursive: true, force: true });
});