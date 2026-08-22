import { chromium, expect } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium";

const browser = await chromium.launch({ headless: true, executablePath, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/analyse`, { waitUntil: "networkidle" });
  await page.locator("#mri-file-input").setInputFiles({
    name: "corrupted.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-valid-png-signature"),
  });
  await expect(page.getByRole("heading", { name: "corrupted.png" })).toBeVisible();
  await expect(page.getByText("The selected image does not have a valid PNG or JPEG signature.")).toBeVisible();
  await expect(page.getByRole("button", { name: /validate and continue/i })).toBeDisabled();
  console.log("Corrupted-upload browser check passed: local signature validation blocked submission before inference.");
} finally {
  await browser.close();
}
