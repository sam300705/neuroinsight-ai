import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";
const publicTestImage = process.env.E2E_PUBLIC_TEST_IMAGE ?? "/home/ubuntu/neuroinsight-datasets/bdneuro_v7/extracted/dataset/test/glioma/glioma_test_00118.jpg";

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/analyse`, { waitUntil: "networkidle" });
  await page.locator("#mri-file-input").setInputFiles(publicTestImage);
  await expect(page.getByRole("button", { name: /validate and continue/i })).toBeEnabled();
  await page.getByRole("button", { name: /validate and continue/i }).click();
  await page.waitForURL(/\/results$/, { timeout: 30_000 });
  await expect(page.getByText("Experimental academic result")).toBeVisible();
  await expect(page.getByText("This system is not a medical diagnosis and must not replace a qualified radiologist.")).toBeVisible();
  await expect(page.getByText("Not a medical probability; manual review remains required.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Save derived research artifacts" })).toBeVisible();
  console.log("Real-inference browser check passed: the dashboard rendered the external experimental result and protected-save consent control.");
} finally {
  await browser.close();
}
