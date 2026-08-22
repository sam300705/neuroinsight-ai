import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";
const publicTestImage = process.env.E2E_PUBLIC_TEST_IMAGE ?? "/home/ubuntu/neuroinsight-datasets/bdneuro_v7/extracted/dataset/test/glioma/glioma_test_00118.jpg";

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem("neuroinsight-language", "en"));
  await page.goto(`${baseUrl}/analyse`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Switch language to Hindi" }).click();
  await expect(page.getByRole("button", { name: "भाषा को अंग्रेज़ी में बदलें" })).toBeVisible();
  await page.locator("#mri-file-input").setInputFiles(publicTestImage);
  const proceed = page.getByRole("button", { name: /सत्यापित करें और आगे बढ़ें/i });
  await expect(proceed).toBeEnabled();
  await proceed.click();
  await page.waitForURL(/\/results$/, { timeout: 30_000 });
  await expect(page.getByText("प्रायोगिक अकादमिक परिणाम")).toBeVisible();
  await expect(page.getByRole("heading", { name: "व्युत्पन्न शोध आर्टिफैक्ट सहेजें" })).toBeVisible();
  await expect(page.getByText("This system is not a medical diagnosis and must not replace a qualified radiologist.")).toBeVisible();
  console.log("Hindi real-inference browser check passed: localized result and protected-save controls render while the mandatory non-diagnostic notice remains exact.");
} finally {
  await browser.close();
}
