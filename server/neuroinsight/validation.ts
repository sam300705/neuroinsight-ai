import { z } from "zod";

/**
 * Only deployed Mode A derived artifacts may enter protected history.
 * Mode B remains unavailable until a full-volume model has passed its separate
 * release gate, so clients cannot manufacture segmentation or 3D artifacts by
 * calling the authenticated API directly.
 */
export const artifactTypeSchema = z.enum(["report", "grad_cam"]);
export const measurementSchema = z.object({
  kind: z.enum(["unavailable", "relative_area", "physical_area", "physical_volume"]),
  pixelCount: z.number().int().nonnegative().optional(),
  voxelCount: z.number().int().nonnegative().optional(),
  occupancyPercent: z.number().min(0).max(100).optional(),
  value: z.number().nonnegative().optional(),
  unit: z.enum(["pixels", "voxels", "percent", "mm²", "mL"]).optional(),
  metadataConfirmed: z.boolean(),
  limitation: z.string().max(2000),
});

export const scanResultSchema = z.object({
  scanId: z.string().uuid(),
  mode: z.literal("classification"),
  status: z.enum(["complete", "low_confidence", "incompatible", "partial", "unavailable"]),
  modelVersion: z.string().min(1).max(128),
  processingTimeMs: z.number().int().nonnegative().max(30 * 60 * 1000),
  predictedClass: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]).optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  calibrated: z.boolean().default(false),
  uncertaintyReason: z.string().max(2000).optional(),
  manualReviewRecommended: z.boolean(),
  measurement: measurementSchema,
  warnings: z.array(z.string().max(1000)).max(20),
});

export const artifactRegistrationSchema = z.object({
  scanId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  contentType: z.enum(["application/pdf", "image/png", "application/json", "model/gltf-binary"]),
  fileName: z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/),
  /** Derived report/overlay/mask bytes only. Raw MRI uploads never use this procedure. */
  base64: z.string().min(1).max(20_000_000),
});

export function validateArtifactPayload(base64: string, contentType: string) {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Derived artifact must be between 1 byte and 10 MB.");
  const signature = bytes.subarray(0, 8).toString("hex");
  if (contentType === "application/pdf" && !bytes.subarray(0, 4).toString().startsWith("%PDF")) throw new Error("Report payload is not a valid PDF header.");
  if (contentType === "image/png" && signature !== "89504e470d0a1a0a") throw new Error("Image payload is not a valid PNG header.");
  return bytes;
}
