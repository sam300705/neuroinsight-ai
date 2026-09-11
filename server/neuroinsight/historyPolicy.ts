import { z } from "zod";

/** Only the deployed Mode A workflow is eligible for history listing. */
export const ACTIVE_HISTORY_MODE = "classification" as const;

/**
 * A strict, bounded cursor query. The API intentionally has no caller-selected
 * mode: unavailable Mode B and legacy enum values must never be listed here.
 */
export const historyListInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.number().int().positive().optional(),
    predictedClass: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]).optional(),
    status: z.enum(["complete", "low_confidence", "incompatible", "partial", "unavailable"]).optional(),
    search: z.string().trim().max(64).optional(),
  })
  .strict()
  .default({ limit: 20 });
