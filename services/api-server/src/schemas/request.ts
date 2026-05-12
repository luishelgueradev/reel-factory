import { z } from "zod";

/**
 * Schema for validating upload request metadata.
 * The file validation itself is handled by Multer's fileFilter,
 * but this schema defines the expected shape for request validation.
 */
export const UploadRequestSchema = z.object({
  // The 'video' field must be present in the multipart form data
  // Multer handles the actual file presence check
  fieldname: z.string().min(1).optional(),
});

/**
 * Type inference from UploadRequestSchema
 */
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

/**
 * Validates that a mimetype is an accepted video type (MP4)
 */
export function isValidVideoMimetype(mimetype: string): boolean {
  return mimetype === "video/mp4";
}

/**
 * Error response schema for upload validation failures
 */
export const UploadErrorSchema = z.object({
  error: z.string(),
});

export type UploadError = z.infer<typeof UploadErrorSchema>;