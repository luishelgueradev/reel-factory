import { z } from "zod";

/**
 * Schema for the synchronous process response.
 * Returned after a successful POST /process upload.
 */
export const ProcessResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: z.string(),
  message: z.string(),
});

/**
 * Type inference from ProcessResponseSchema
 */
export type ProcessResponse = z.infer<typeof ProcessResponseSchema>;

/**
 * Schema for the artifact listing response.
 * Returned from GET /artifacts/:jobId
 */
export const ArtifactResponseSchema = z.object({
  jobId: z.string(),
  videoUrl: z.string(),
  artifacts: z.record(z.array(z.string())),
  duration_seconds: z.number(),
});

/**
 * Type inference from ArtifactResponseSchema
 */
export type ArtifactResponse = z.infer<typeof ArtifactResponseSchema>;

/**
 * Schema for artifact not found error response
 */
export const ArtifactNotFoundSchema = z.object({
  error: z.string(),
  jobId: z.string(),
  stepName: z.string().optional(),
  filename: z.string().optional(),
});

export type ArtifactNotFound = z.infer<typeof ArtifactNotFoundSchema>;