import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const passport = {
  schema_version: "neuroinsight-research-passport/v1",
  generated_at: "2026-09-11T00:00:00.000Z",
  scope: "academic_non_clinical_research",
  input: {
    file_name: "source.png",
    file_size_bytes: 3,
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    retention: "memory_only_in_dashboard",
  },
  analysis: {
    request_id: "browser-passport-gate",
    scan_id: "4bd2757f-ccf4-45e0-ad2d-5a6ea239a01a",
    mode: "classification",
    status: "complete",
    model_version: "bdneuro-v7-resnet50-head-only-exp005",
    predicted_class: "glioma",
    model_confidence_score: 0.91,
    calibrated: true,
    uncertainty_reason: null,
    manual_review_recommended: true,
    processing_time_ms: 42,
    validation_abstention_threshold: 0.55,
    threshold_margin: 0.36,
  },
  evidence: {
    grad_cam_available: true,
    integrity_receipt_available: true,
    measurement_kind: "unavailable",
    measurement_metadata_confirmed: false,
    same_input_repeatability: null,
    validation_calibration: {
      modelVersion: "bdneuro-v7-resnet50-head-only-exp005",
      evidenceScope: "same_dataset_image_level_validation_only",
      temperature: 0.6899,
      eceBefore: 0.0885,
      eceAfter: 0.0251,
      brierBefore: 0.279,
      brierAfter: 0.266,
      abstentionThreshold: 0.55,
      validationCoverage: 0.8821,
      acceptedSampleAccuracy: 0.8535,
    },
  },
  explicit_non_claims: [
    "No clinical diagnosis or treatment recommendation is claimed.",
  ],
  warnings: ["research only"],
  limitations: ["not clinically validated"],
};

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ["--no-sandbox"],
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/verify`, { waitUntil: "networkidle" });

  const networkAfterLoad = [];
  page.on("request", request => {
    if (["xhr", "fetch"].includes(request.resourceType())) networkAfterLoad.push(request.url());
  });

  const fileInputs = page.locator('input[type="file"]');
  await expect(fileInputs).toHaveCount(2);
  await fileInputs.nth(0).setInputFiles({
    name: "passport.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(passport)),
  });
  await expect(page.getByText("Recognized v1", { exact: true })).toBeVisible();

  await fileInputs.nth(1).setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: Buffer.from("abc"),
  });
  await expect(page.getByText("Exact SHA-256 match", { exact: true }).first()).toBeVisible();

  await fileInputs.nth(1).setInputFiles({
    name: "source.png",
    mimeType: "image/png",
    buffer: Buffer.from("different"),
  });
  await expect(page.getByText("SHA-256 mismatch", { exact: true }).first()).toBeVisible();

  if (networkAfterLoad.length) {
    throw new Error(`Local passport verification unexpectedly made network requests: ${networkAfterLoad.join(", ")}`);
  }
  console.log("Research Passport browser check passed: schema parsed locally, source match/mismatch verified, and no fetch/XHR request was emitted.");
  await context.close();
} finally {
  await browser.close();
}
