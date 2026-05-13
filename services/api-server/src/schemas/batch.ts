import { z } from "zod";

/**
 * Schema for an individual batch job entry.
 * Used in both the initial batch response and status polling.
 */
export const BatchJobSchema = z.object({
  jobId: z.string().uuid(),
  filename: z.string(),
  status: z.enum(["queued", "active", "completed", "failed"]),
});

/**
 * Type inference from BatchJobSchema
 */
export type BatchJob = z.infer<typeof BatchJobSchema>;

/**
 * Possible job status values, reusable in route handlers.
 */
export const JOB_STATUS_VALUES = [
  "queued",
  "active",
  "completed",
  "failed",
] as const;

/**
 * Schema for the batch creation response.
 * Returned after a successful POST /batch upload.
 */
export const BatchResponseSchema = z.object({
  batchId: z.string().uuid(),
  jobs: z.array(BatchJobSchema),
  createdAt: z.string(),
});

/**
 * Type inference from BatchResponseSchema
 */
export type BatchResponse = z.infer<typeof BatchResponseSchema>;

/**
 * Schema for a single job within a batch status response.
 * Includes optional progress fields (currentStep, error) for transparency.
 */
export const BatchStatusJobSchema = z.object({
  jobId: z.string().uuid(),
  filename: z.string(),
  status: z.enum(["queued", "active", "completed", "failed"]),
  currentStep: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Schema for the batch status polling response.
 * Returned from GET /batch/:batchId/status.
 */
export const BatchStatusResponseSchema = z.object({
  batchId: z.string().uuid(),
  jobs: z.array(BatchStatusJobSchema),
  completedCount: z.number(),
  failedCount: z.number(),
  totalCount: z.number(),
});

/**
 * Type inference from BatchStatusResponseSchema
 */
export type BatchStatusResponse = z.infer<typeof BatchStatusResponseSchema>;