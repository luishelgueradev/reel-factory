import { Worker, Job } from "bullmq";
import fs from "fs/promises";
import path from "path";
import { runPipeline, PipelineStepError } from "./orchestrator.js";
import { STEPS } from "./orchestrator.js";
import { updateJobProgress } from "./progress.js";
import { QUEUE_NAME, createQueueConnection } from "./queue.js";
import { PIPELINE_DATA_DIR, MAX_CONCURRENT_JOBS } from "./constants.js";

/**
 * BullMQ job processor that wraps runPipeline() with per-step progress tracking.
 *
 * For each job:
 * 1. Cleans up any prior partial output directories (for retry scenarios per D-06)
 * 2. Calls runPipeline() with an onStepStart callback that updates Redis progress
 * 3. On success, marks job status as "completed" in Redis
 * 4. On failure, marks job status as "failed" with error details in Redis
 * 5. Re-throws errors so BullMQ can handle retries
 *
 * @param job - BullMQ Job with data containing { jobId, batchId, filename, inputPath }
 */
export async function processJob(job: Job): Promise<void> {
  const { jobId } = job.data;

  // Clean up any prior partial outputs on retry (per D-06)
  // This ensures each pipeline step starts fresh, keeping the input/video.mp4 intact
  const jobDir = path.join(PIPELINE_DATA_DIR, jobId);
  const stepDirs = STEPS.map(s => path.join(jobDir, s.name));
  for (const stepDir of stepDirs) {
    try {
      await fs.rm(stepDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist on first attempt — safe to ignore
    }
  }

  // Step-by-step progress tracking via onStepStart callback
  const onStepStart = async (stepName: string, stepIndex: number, totalSteps: number) => {
    await updateJobProgress(jobId, {
      status: "active",
      currentStep: stepName,
    });
    // Also update job progress in BullMQ for queue-level tracking
    await job.updateProgress(Math.round(((stepIndex + 1) / totalSteps) * 100));
  };

  try {
    const result = await runPipeline(jobId, { onStepStart });
    await updateJobProgress(jobId, {
      status: "completed",
      currentStep: "completed",
    });
  } catch (err) {
    if (err instanceof PipelineStepError) {
      await updateJobProgress(jobId, {
        status: "failed",
        currentStep: err.stepName,
        error: `Step ${err.stepName} failed (exit ${err.exitCode}): ${err.errorMessage}`,
      });
    } else {
      await updateJobProgress(jobId, {
        status: "failed",
        currentStep: "unknown",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
    throw err; // Re-throw for BullMQ retry handling
  }
}

/**
 * Start the BullMQ worker that processes video-processing jobs.
 * Per D-12, runs in the same Node.js process as the Express server.
 * Per D-08, default concurrency is 2 (configurable via MAX_CONCURRENT_JOBS env var).
 */
export function startWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, processJob, {
    connection: createQueueConnection(),
    concurrency: MAX_CONCURRENT_JOBS,
  });

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} (pipeline ${job.data.jobId}) completed successfully`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} (pipeline ${job?.data?.jobId}) failed: ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`Worker error: ${err.message}`);
  });

  console.log(`Worker started with concurrency ${MAX_CONCURRENT_JOBS}`);
  return worker;
}

/**
 * Gracefully shut down the BullMQ worker.
 * Call on SIGTERM/SIGINT to allow in-progress jobs to complete.
 */
export async function stopWorker(worker?: Worker): Promise<void> {
  if (worker) {
    await worker.close();
  }
}