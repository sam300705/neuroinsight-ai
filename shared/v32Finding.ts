import { z } from "zod";

export const v32FindingSummarySchema = z.object({
  schema_version: z.literal("neuroinsight-finding/v1"),
  final_label: z.enum(["glioma", "meningioma", "pituitary", "no_tumor", "possible_tumor (type unclear)"]),
  tumor_detected: z.boolean(),
  needs_review: z.boolean(),
  review_reasons: z.array(z.string().max(250)).max(8),
  mask_uncertain: z.boolean(),
  mask_notes: z.array(z.string().max(250)).max(8),
  image: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  bbox: z.object({
    x_min: z.number().int().nonnegative(),
    y_min: z.number().int().nonnegative(),
    x_max: z.number().int().nonnegative(),
    y_max: z.number().int().nonnegative(),
  }).nullable(),
  tumor_area_px: z.number().int().positive().nullable(),
  tumor_pct_of_image: z.number().min(0).max(100).nullable(),
  tumor_pct_of_brain: z.number().min(0).nullable(),
});

export const v32FindingSchema = v32FindingSummarySchema.extend({
  class: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]),
  confidence: z.number().min(0).max(1),
  mask_png_base64: z.string().max(14_000_000).nullable(),
  overlay_png_base64: z.string().max(20_000_000).nullable(),
}).strict();

export type V32Finding = z.infer<typeof v32FindingSchema>;
