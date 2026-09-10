import { z } from "zod";
import { sha256File } from "@/lib/researchPassport";

const MAX_PASSPORT_BYTES = 512 * 1024;
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const repeatabilitySchema = z.object({
  runs: z.number().int().min(2).max(4),
  uniqueRequestIds: z.boolean().optional(),
  uniqueScanIds: z.boolean().optional(),
  stableClass: z.boolean(),
  stableStatus: z.boolean(),
  stableCalibration: z.boolean(),
  attributionAvailable: z.boolean().optional(),
  stableAttribution: z.boolean().optional(),
  confidenceSpread: z.number().nonnegative().nullable(),
  tolerance: z.number().positive(),
  passed: z.boolean(),
  outcomes: z.array(z.object({
    requestId: z.string().min(1).max(128),
    scanId: z.string().uuid().optional(),
    status: z.enum(["complete", "low_confidence", "unavailable", "incompatible", "partial"]),
    predictedClass: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]).nullable().optional(),
    confidence: z.number().min(0).max(1).nullable(),
    calibrated: z.boolean(),
    gradCamAvailable: z.boolean().optional(),
  }).strict()).min(2).max(4),
}).strict();

const validationCalibrationSchema = z.object({
  modelVersion: z.literal("bdneuro-v7-resnet50-head-only-exp005"),
  evidenceScope: z.literal("same_dataset_image_level_validation_only"),
  temperature: z.number().positive(),
  eceBefore: z.number().nonnegative(),
  eceAfter: z.number().nonnegative(),
  brierBefore: z.number().nonnegative(),
  brierAfter: z.number().nonnegative(),
  abstentionThreshold: z.number().gt(0).lt(1),
  validationCoverage: z.number().min(0).max(1),
  acceptedSampleAccuracy: z.number().min(0).max(1),
}).strict();

const passportSchema = z.object({
  schema_version: z.literal("neuroinsight-research-passport/v1"),
  generated_at: z.string().datetime({ offset: true }),
  scope: z.literal("academic_non_clinical_research"),
  input: z.object({
    file_name: z.string().min(1).max(512),
    file_size_bytes: z.number().int().nonnegative(),
    sha256: sha256Schema.nullable(),
    retention: z.literal("memory_only_in_dashboard"),
  }).strict(),
  analysis: z.object({
    request_id: z.string().min(1).max(128),
    scan_id: z.string().uuid(),
    mode: z.enum(["classification", "segmentation"]),
    status: z.enum(["complete", "low_confidence", "unavailable", "incompatible", "partial"]),
    model_version: z.string().min(1).max(256),
    predicted_class: z.enum(["glioma", "meningioma", "pituitary", "no_tumor"]).nullable().optional(),
    model_confidence_score: z.number().min(0).max(1).nullable(),
    calibrated: z.boolean(),
    uncertainty_reason: z.string().max(2_000).nullable(),
    manual_review_recommended: z.boolean(),
    processing_time_ms: z.number().int().nonnegative(),
    validation_abstention_threshold: z.number().gt(0).lt(1).nullable(),
    threshold_margin: z.number().nullable(),
  }).strict(),
  evidence: z.object({
    grad_cam_available: z.boolean(),
    integrity_receipt_available: z.boolean(),
    measurement_kind: z.enum(["unavailable", "relative_area", "physical_area", "physical_volume"]),
    measurement_metadata_confirmed: z.boolean(),
    same_input_repeatability: repeatabilitySchema.nullable(),
    validation_calibration: validationCalibrationSchema.nullable(),
  }).strict(),
  explicit_non_claims: z.array(z.string().min(1).max(2_000)).min(1).max(50),
  warnings: z.array(z.string().max(2_000)).max(100),
  limitations: z.array(z.string().max(2_000)).max(100),
}).strict();

export type VerifiedResearchPassport = z.infer<typeof passportSchema>;

export type PassportParseResult =
  | { ok: true; passport: VerifiedResearchPassport }
  | { ok: false; message: string };

export function parseResearchPassportText(text: string): PassportParseResult {
  if (new TextEncoder().encode(text).byteLength > MAX_PASSPORT_BYTES) {
    return { ok: false, message: "The research passport exceeds the 512 KB local verification limit." };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return { ok: false, message: "The selected file is not valid JSON." };
  }
  const parsed = passportSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message: "The JSON does not match the NeuroInsight Research Passport v1 schema.",
    };
  }
  return { ok: true, passport: parsed.data };
}

export async function verifyPassportSourceFile(
  passport: VerifiedResearchPassport,
  file: File,
): Promise<
  | { ok: true; match: boolean; actualSha256: string; expectedSha256: string }
  | { ok: false; message: string }
> {
  const expected = passport.input.sha256;
  if (!expected) {
    return { ok: false, message: "This passport does not contain a source SHA-256 fingerprint." };
  }
  const actual = await sha256File(file);
  if (!actual) {
    return { ok: false, message: "This browser could not compute a local SHA-256 fingerprint." };
  }
  return { ok: true, match: actual === expected, actualSha256: actual, expectedSha256: expected };
}

export function passportIntegritySummary(passport: VerifiedResearchPassport) {
  return {
    schemaRecognized: true,
    sourceFingerprintAvailable: Boolean(passport.input.sha256),
    serverReceiptWasAvailable: passport.evidence.integrity_receipt_available,
    repeatabilityPassed: passport.evidence.same_input_repeatability?.passed ?? null,
    calibrated: passport.analysis.calibrated,
    manualReviewRecommended: passport.analysis.manual_review_recommended,
    cryptographicReceiptVerifiedHere: false as const,
  };
}
