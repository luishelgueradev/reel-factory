import { z } from "zod";

/**
 * Schema for GET /status/{jobId} response.
 * Per D-01: step-aware response with progress percentage and stepInfo.
 */
export const StatusResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["queued", "active", "completed", "failed"]),
  currentStep: z.string(),
  progress: z.number().min(0).max(100),
  stepInfo: z.string(),
  steps: z.array(z.string()),
  startedAt: z.string().nullable(),
  error: z.string().optional(),
});

export type StatusResponse = z.infer<typeof StatusResponseSchema>;