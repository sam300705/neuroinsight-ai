import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const { E2E_INPUT_IMAGE, E2E_BASE_URL, INFERENCE_API_BASE_URL, PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } = process.env;
if (!E2E_INPUT_IMAGE || !E2E_BASE_URL || !INFERENCE_API_BASE_URL) {
  throw new Error("Set E2E_INPUT_IMAGE, E2E_BASE_URL, and INFERENCE_API_BASE_URL for the private browser check.");
}
const browser = await chromium.launch({
  executablePath: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  args: ["--no-sandbox"],
});

const labels = {
  "possible_tumor (type unclear)": "Possible tumor — type unclear",
  no_tumor: "No tumor detected on this slice",
  glioma: "Glioma",
  meningioma: "Meningioma",
  pituitary: "Pituitary tumor",
};

async function imageDimensions(image) {
  return image.evaluate(async element => {
    await element.decode();
    return { width: element.naturalWidth, height: element.naturalHeight };
  });
}

try {
  const page = await browser.newPage();
  await page.goto(new URL("/analyse", E2E_BASE_URL).href);
  await page.getByRole("checkbox").check();
  await page.locator("input[type=file]").setInputFiles(E2E_INPUT_IMAGE);
  const submit = page.getByRole("button", { name: "Validate and continue" });
  await submit.waitFor();
  const [response] = await Promise.all([
    page.waitForResponse(candidate =>
      candidate.url() === new URL("/api/v1/analyze", INFERENCE_API_BASE_URL).href
      && candidate.request().method() === "POST", { timeout: 50_000 }),
    submit.click(),
  ]);
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.equal(result.model_version, "neuroinsight-ai-v3.2");
  assert.equal(result.finding?.schema_version, "neuroinsight-finding/v1");
  const finding = result.finding;
  await page.waitForURL("**/results");
  await page.getByRole("heading", { level: 1, name: labels[finding.final_label] }).waitFor();
  if (finding.final_label === "no_tumor") {
    await page.getByText("The model can miss tumors on a slice, even when classifier confidence is high.").waitFor();
  }
  await page.getByText("Classifier confidence", { exact: true }).waitFor();
  await page.getByRole("img", { name: "Classifier attention" }).waitFor();

  if (process.env.E2E_REQUIRE_OUTLINE === "true") assert.ok(finding.overlay_png_base64);
  if (finding.overlay_png_base64) {
    const outline = page.getByRole("img", { name: "Predicted 2D outline" });
    assert.deepEqual(await imageDimensions(outline), finding.image);
    assert.equal(await outline.getAttribute("src"), `data:image/png;base64,${finding.overlay_png_base64}`);
    await page.getByRole("button", { name: "Predicted 2D outline" }).click();
  }
  assert.deepEqual(await imageDimensions(page.getByRole("img", { name: "Original MRI slice" })), finding.image);

  assert.ok(result.analysis_receipt);
  const report = await page.request.post(new URL("/api/v1/report", INFERENCE_API_BASE_URL).href, {
    data: {
      analysis_receipt: result.analysis_receipt,
      segmentation_png_base64: finding.mask_png_base64,
    },
  });
  assert.equal(report.status(), 200);
  assert.equal((await report.body()).subarray(0, 4).toString(), "%PDF");
  console.log(`v3.2 browser and PDF passed. Finding=${finding.final_label}, outline=${Boolean(finding.mask_png_base64)}.`);
} finally {
  await browser.close();
}
